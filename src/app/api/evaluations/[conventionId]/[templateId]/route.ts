import { NextResponse } from 'next/server';
import pool from '@/lib/pg';
import { auth } from '@/auth';

export async function GET(req: Request, props: { params: Promise<{ conventionId: string, templateId: string }> }) {
    const params = await props.params;
    try {
        const session = await auth();
        if (!session || !session.user || !session.user.email) {
            return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
        }

        const { conventionId, templateId } = params;

        if (!conventionId || !templateId) {
            return NextResponse.json({ error: "Paramètres conventionId et templateId requis." }, { status: 400 });
        }

        const sqlQuery = `
            SELECT * FROM evaluations 
            WHERE convention_id = $1 AND template_id = $2
            LIMIT 1;
        `;

        const result = await pool.query(sqlQuery, [conventionId, templateId]);

        if (result.rows.length === 0) {
            return NextResponse.json({ evaluation: null }); // Pas d'erreur, juste pas encore remplie
        }

        // On formate pour matcher ce que le frontend attendait de Firebase
        const row = result.rows[0];
        const evaluationData = {
            id: `${row.convention_id}_${row.template_id}`, // Simulacre d'ID Firebase pour la compat UI
            conventionId: row.convention_id,
            templateId: row.template_id,
            evaluatorEmail: row.evaluator_email,
            answers: row.answers,
            synthesis: row.synthesis,
            updatedAt: row.updated_at,
        };

        return NextResponse.json({ success: true, evaluation: evaluationData });

    } catch (error) {
        console.error("Erreur API GET /evaluations/[conventionId]/[templateId] :", error);
        return NextResponse.json({ error: "Erreur serveur lors du chargement de l'évaluation." }, { status: 500 });
    }
}
