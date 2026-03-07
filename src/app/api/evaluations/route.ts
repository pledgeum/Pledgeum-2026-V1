import { NextResponse } from 'next/server';
import pool from '@/lib/pg';
import { auth } from '@/auth';

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session || !session.user || !session.user.email) {
            return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
        }

        const body = await req.json();
        const { conventionId, templateId, evaluatorEmail, answers, synthesis } = body;

        if (!conventionId || !templateId || !evaluatorEmail || !answers) {
            return NextResponse.json({ error: "Données manquantes (conventionId, templateId, evaluatorEmail, answers)." }, { status: 400 });
        }

        // Vérification de sécurité de base : l'email de l'évaluateur correspond-il à celui de la session, 
        // ou est-ce un admin/test. (Tolérance pour les tests admin)
        if (evaluatorEmail !== session.user.email && session.user.email !== 'pledgeum@gmail.com') {
            console.warn(`[Evaluation API] Auth mismatch: session ${session.user.email} tried to save for ${evaluatorEmail}`);
            return NextResponse.json({ error: "Action non autorisée pour ce compte." }, { status: 403 });
        }

        // L'instruction SQL d'UPSERT avec le JSONB stringifié
        const sqlQuery = `
            INSERT INTO evaluations (convention_id, template_id, evaluator_email, answers, synthesis)
            VALUES ($1, $2, $3, $4::jsonb, $5)
            ON CONFLICT (convention_id, template_id) 
            DO UPDATE SET 
                answers = $4::jsonb, 
                synthesis = $5, 
                evaluator_email = $3,
                updated_at = NOW()
            RETURNING *;
        `;

        const values = [
            conventionId,
            templateId,
            evaluatorEmail,
            JSON.stringify(answers), // Cast on the driver side as string, ::jsonb handles it in PG
            synthesis || null
        ];

        const result = await pool.query(sqlQuery, values);

        return NextResponse.json({ success: true, evaluation: result.rows[0] });

    } catch (error) {
        console.error("Erreur API POST /evaluations :", error);
        return NextResponse.json({ error: "Erreur serveur lors de la sauvegarde de l'évaluation." }, { status: 500 });
    }
}
