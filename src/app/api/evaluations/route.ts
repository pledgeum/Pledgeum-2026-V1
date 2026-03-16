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
        const { 
            conventionId, 
            templateId, 
            evaluatorEmail, 
            answers, 
            synthesis, 
            status, 
            final_grade,
            teacher_signature_img,
            teacher_signature_hash,
            teacher_signature_ip
        } = body;

        if (!conventionId || !templateId || !evaluatorEmail || !answers) {
            return NextResponse.json({ error: "Données manquantes (conventionId, templateId, evaluatorEmail, answers)." }, { status: 400 });
        }

        // Vérification de sécurité : Verrouillage si FINALIZED
        const checkLock = await pool.query(
            "SELECT status FROM evaluations WHERE convention_id = $1 AND template_id = $2",
            [conventionId, templateId]
        );
        if (checkLock.rows.length > 0 && checkLock.rows[0].status === 'FINALIZED') {
            return NextResponse.json({ error: "Cette évaluation est finale et ne peut plus être modifiée." }, { status: 403 });
        }

        // L'instruction SQL d'UPSERT avec les nouveaux champs
        const sqlQuery = `
            INSERT INTO evaluations (
                convention_id, template_id, evaluator_email, answers, synthesis, 
                status, final_grade, teacher_signature_img, teacher_signature_hash, teacher_signature_ip,
                teacher_signed_at
            )
            VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, 
                CASE WHEN $6 = 'FINALIZED' THEN NOW() ELSE NULL END
            )
            ON CONFLICT (convention_id, template_id) 
            DO UPDATE SET 
                answers = $4::jsonb, 
                synthesis = $5, 
                evaluator_email = $3,
                status = $6,
                final_grade = $7,
                teacher_signature_img = $8,
                teacher_signature_hash = $9,
                teacher_signature_ip = $10,
                teacher_signed_at = CASE WHEN $6 = 'FINALIZED' AND evaluations.status != 'FINALIZED' THEN NOW() ELSE evaluations.teacher_signed_at END,
                updated_at = NOW()
            RETURNING *;
        `;

        const values = [
            conventionId,
            templateId,
            evaluatorEmail,
            JSON.stringify(answers),
            synthesis || null,
            status || 'DRAFT',
            final_grade || null,
            teacher_signature_img || null,
            teacher_signature_hash || null,
            teacher_signature_ip || null
        ];

        const result = await pool.query(sqlQuery, values);

        return NextResponse.json({ success: true, evaluation: result.rows[0] });

    } catch (error) {
        console.error("Erreur API POST /evaluations :", error);
        return NextResponse.json({ error: "Erreur serveur lors de la sauvegarde de l'évaluation." }, { status: 500 });
    }
}
