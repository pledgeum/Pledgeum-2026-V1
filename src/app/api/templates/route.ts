import { NextResponse } from 'next/server';
import pool from '@/lib/pg';
import { auth } from '@/auth';

export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session || !session.user || !session.user.id) {
            return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
        }

        const role = (session.user as any)?.role;
        const userId = session.user.id;

        // Les AT DDFPT voient tous les modèles du lycée, les profs voient les leurs
        let sqlQuery = '';
        let values: any[] = [];

        if (role === 'at_ddfpt') {
            sqlQuery = `SELECT * FROM evaluation_templates ORDER BY created_at DESC;`;
        } else {
            sqlQuery = `SELECT * FROM evaluation_templates WHERE author_id = $1 ORDER BY created_at DESC;`;
            values = [userId];
        }

        const result = await pool.query(sqlQuery, values);

        // Map vers le format attendu par le frontend JS
        const templates = result.rows.map(row => ({
            id: row.id,
            authorId: row.author_id,
            title: row.title,
            subtitle: row.subtitle,
            structure: row.structure,
            assignedClassIds: row.assigned_class_ids || [],
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }));

        return NextResponse.json({ success: true, templates });

    } catch (error) {
        console.error("Erreur API GET /templates :", error);
        return NextResponse.json({ error: "Erreur serveur lors de la récupération des modèles." }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session || !session.user || !session.user.id) {
            return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
        }

        const body = await req.json();
        const { title, subtitle, structure } = body;

        if (!title) {
            return NextResponse.json({ error: "Le titre est requis." }, { status: 400 });
        }

        const sqlQuery = `
            INSERT INTO evaluation_templates (author_id, title, subtitle, structure)
            VALUES ($1, $2, $3, $4::jsonb)
            RETURNING *;
        `;

        const values = [
            session.user.id,
            title,
            subtitle || null,
            JSON.stringify(structure || {})
        ];

        const result = await pool.query(sqlQuery, values);

        const newTemplate = {
            id: result.rows[0].id,
            authorId: result.rows[0].author_id,
            title: result.rows[0].title,
            subtitle: result.rows[0].subtitle,
            structure: result.rows[0].structure,
            assignedClassIds: result.rows[0].assigned_class_ids,
        };

        return NextResponse.json({ success: true, template: newTemplate });

    } catch (error) {
        console.error("Erreur API POST /templates :", error);
        return NextResponse.json({ error: "Erreur serveur lors de la création du modèle." }, { status: 500 });
    }
}
