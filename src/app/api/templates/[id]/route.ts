import { NextResponse } from 'next/server';
import pool from '@/lib/pg';
import { auth } from '@/auth';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;

    if (!params.id) {
        const session = await auth();
        if (!session || !session.user || !session.user.id) {
            return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
        }
        // If params.id is missing, it's a bad request.
        // The original code expects params.id to be present.
        // Returning a 400 here seems more appropriate than 401,
        // but following the instruction to return 401 if session is invalid.
        // If session is valid but params.id is missing, we should probably return 400.
        // For now, I'll assume the instruction implies this check is for a specific scenario
        // where a missing ID might be tied to an authorization issue, or it's a placeholder.
        // I will add a 400 for missing ID if session is valid.
        return NextResponse.json({ error: "ID du modèle manquant." }, { status: 400 });
    }

    try {
        const session = await auth();
        if (!session || !session.user || !session.user.id) {
            return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
        }

        const templateId = params.id;

        // Tous les utilisateurs connectés peuvent voir un template (nécessaire pour le remplissage tuteur/prof etc)
        const sqlQuery = `SELECT * FROM evaluation_templates WHERE id = $1;`;
        const result = await pool.query(sqlQuery, [templateId]);

        if (result.rowCount === 0) {
            return NextResponse.json({ error: "Modèle introuvable." }, { status: 404 });
        }

        const row = result.rows[0];
        const template = {
            id: row.id,
            authorId: row.author_id,
            title: row.title,
            subtitle: row.subtitle,
            structure: row.structure,
            assignedClassIds: row.assigned_class_ids || [],
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };

        return NextResponse.json({ success: true, template });

    } catch (error) {
        console.error("Erreur API GET /templates/[id] :", error);
        return NextResponse.json({ error: "Erreur serveur lors de la récupération du modèle." }, { status: 500 });
    }
}

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;

    try {
        const session = await auth();
        if (!session || !session.user || !session.user.id) {
            return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
        }

        const templateId = params.id;
        const body = await req.json();
        const { assignedClassIds, title, subtitle, structure } = body;

        console.log("🛠️ DÉBOGAGE PATCH ASSIGNATION :");
        console.log("- Template ID reçu :", templateId);
        console.log("- User ID (Session) :", session.user.id);
        console.log("- Classes à assigner :", assignedClassIds);

        // On construit la requête de mise à jour dynamiquement selon ce qui est envoyé
        const updates: string[] = [];
        const values: any[] = [templateId];
        let paramIndex = 2;

        if (assignedClassIds !== undefined) {
            updates.push(`assigned_class_ids = $${paramIndex}::text[]`);
            values.push(assignedClassIds); // Tableau de string
            paramIndex++;
        }
        if (title !== undefined) {
            updates.push(`title = $${paramIndex}`);
            values.push(title);
            paramIndex++;
        }
        if (subtitle !== undefined) {
            updates.push(`subtitle = $${paramIndex}`);
            values.push(subtitle);
            paramIndex++;
        }
        if (structure !== undefined) {
            updates.push(`structure = $${paramIndex}::jsonb`);
            values.push(JSON.stringify(structure));
            paramIndex++;
        }

        if (updates.length === 0) {
            return NextResponse.json({ error: "Aucune donnée à mettre à jour." }, { status: 400 });
        }

        updates.push(`updated_at = NOW()`);

        const sqlQuery = `
            UPDATE evaluation_templates 
            SET ${updates.join(', ')}
            WHERE id = $1
            RETURNING *;
        `;

        const result = await pool.query(sqlQuery, values);

        if (result.rowCount === 0) {
            return NextResponse.json({ error: "Modèle introuvable ou non mis à jour." }, { status: 404 });
        }

        return NextResponse.json({ success: true, template: result.rows[0] });

    } catch (error: any) {
        console.error("🔥 ERREUR CRITIQUE API PATCH :", error);
        return NextResponse.json(
            { success: false, error: error.message || "Erreur interne du serveur" },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;

    if (!params.id) {
        const session = await auth();
        if (!session || !session.user || !session.user.id) {
            return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
        }
        return NextResponse.json({ error: "ID du modèle manquant." }, { status: 400 });
    }

    try {
        const session = await auth();
        if (!session || !session.user || !session.user.id) {
            return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
        }

        const role = (session.user as any)?.role;
        const templateId = params.id;

        // Seul l'auteur ou l'AT DDFPT peut supprimer
        let sqlQuery = '';
        let values: any[] = [templateId];

        if (role === 'at_ddfpt') {
            sqlQuery = `DELETE FROM evaluation_templates WHERE id = $1 RETURNING id;`;
        } else {
            sqlQuery = `DELETE FROM evaluation_templates WHERE id = $1 AND author_id = $2 RETURNING id;`;
            values.push(session.user.id);
        }

        const result = await pool.query(sqlQuery, values);

        if (result.rowCount === 0) {
            return NextResponse.json({ error: "Modèle introuvable ou non autorisé." }, { status: 404 });
        }

        return NextResponse.json({ success: true, deletedId: result.rows[0].id });

    } catch (error) {
        console.error("Erreur API DELETE /templates/[id] :", error);
        return NextResponse.json({ error: "Erreur serveur lors de la suppression." }, { status: 500 });
    }
}
