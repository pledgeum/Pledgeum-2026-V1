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
            tutorAnswers: row.tutor_answers,
            synthesis: row.synthesis,
            status: row.status,
            finalGrade: row.final_grade,
            teacherSignedAt: row.teacher_signed_at,
            teacherSignatureImg: row.teacher_signature_img,
            updatedAt: row.updated_at,
        };

        return NextResponse.json({ success: true, evaluation: evaluationData });

    } catch (error) {
        console.error("Erreur API GET /evaluations/[conventionId]/[templateId] :", error);
        return NextResponse.json({ error: "Erreur serveur lors du chargement de l'évaluation." }, { status: 500 });
    }
}

export async function PATCH(req: Request, props: { params: Promise<{ conventionId: string, templateId: string }> }) {
    const params = await props.params;
    try {
        const session = await auth();
        if (!session || !session.user || !session.user.email) {
            return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
        }

        const { conventionId, templateId } = params;
        const body = await req.json();
        const { answers, synthesis, status, final_grade, signature } = body;

        const userEmail = session.user.email;
        const role = (session.user as any)?.role;

        console.log("🕵️‍♂️ [FORENSIC] DÉBUT SAUVEGARDE");
        console.log("ROLE:", role);
        console.log("EMAIL:", userEmail);
        console.log("CONVENTION_ID:", conventionId);
        console.log("TEMPLATE_ID:", templateId);

        // 1. Fetch current state
        const currentRes = await pool.query(
            "SELECT * FROM evaluations WHERE convention_id = $1 AND template_id = $2",
            [conventionId, templateId]
        );

        const current = currentRes.rows[0];

        // 2. Lock if FINALIZED
        if (current && current.status === 'FINALIZED') {
            return NextResponse.json({ error: "Évaluation verrouillée." }, { status: 403 });
        }

        // 3. Hierarchy logic
        const currentConventionRes = await pool.query("SELECT * FROM conventions WHERE id = $1", [conventionId]);
        const convention = currentConventionRes.rows[0];
        
        if (!convention) {
            return NextResponse.json({ error: "Convention introuvable." }, { status: 404 });
        }

        const normalizedUserEmail = userEmail.toLowerCase().trim();
        const teacherEmail = (convention.prof_email || convention.metadata?.prof_email)?.toLowerCase().trim();
        const trackingTeacherEmail = (convention.prof_suivi_email || convention.metadata?.prof_suivi_email)?.toLowerCase().trim();
        const tutorEmail = (convention.tutor_email || convention.metadata?.tuteur_email)?.toLowerCase().trim();
        const repEmail = (convention.ent_rep_email || convention.metadata?.ent_rep_email)?.toLowerCase().trim();

        const isTeacher = role === 'teacher' || role === 'teacher_tracker' || 
                          normalizedUserEmail === 'pledgeum@gmail.com' ||
                          normalizedUserEmail === teacherEmail || 
                          normalizedUserEmail === trackingTeacherEmail;

        const isTutor = (role === 'tutor' || role === 'company_head' || role === 'company_head_tutor' || normalizedUserEmail === 'pledgeum@gmail.com') && 
                        (normalizedUserEmail === tutorEmail || normalizedUserEmail === repEmail || normalizedUserEmail === 'pledgeum@gmail.com');

        if (!isTeacher && !isTutor) {
            return NextResponse.json({ error: "Droits insuffisants." }, { status: 403 });
        }

        // Only teacher can finalize or set final_grade
        if ((status === 'FINALIZED' || final_grade) && !isTeacher) {
            return NextResponse.json({ error: "Seul l'enseignant peut finaliser l'évaluation." }, { status: 403 });
        }

        // Merge answers if it's a partial update? 
        // Hierarchy: If Tutor saves, we update answers AND tutor_answers.
        // If Teacher saves, we ONLY update answers.
        
        const finalAnswers = answers || (current ? current.answers : {});
        const finalTutorAnswers = isTutor ? finalAnswers : (current ? current.tutor_answers : {});

        console.log("🕵️‍♂️ [FORENSIC] ANSWERS RECEIVED (keys):", Object.keys(answers || {}));
        console.log("🕵️‍♂️ [FORENSIC] FULL ANSWERS PAYLOAD:", JSON.stringify(answers));

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const sqlQuery = `
                INSERT INTO evaluations (
                    convention_id, template_id, evaluator_email, answers, tutor_answers, synthesis, 
                    status, final_grade, teacher_signature_img, teacher_signature_hash, teacher_signature_ip,
                    teacher_signed_at
                )
                VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7::text, $8::text, $9, $10, $11, 
                    CASE WHEN $7::text = 'FINALIZED' THEN NOW() ELSE NULL END
                )
                ON CONFLICT (convention_id, template_id) 
                DO UPDATE SET 
                    answers = COALESCE(evaluations.answers, '{}'::jsonb) || $4::jsonb, 
                    tutor_answers = COALESCE(evaluations.tutor_answers, '{}'::jsonb) || $5::jsonb,
                    synthesis = $6, 
                    evaluator_email = $3,
                    status = $7::text,
                    final_grade = $8::text,
                    teacher_signature_img = EXCLUDED.teacher_signature_img,
                    teacher_signature_hash = EXCLUDED.teacher_signature_hash,
                    teacher_signature_ip = EXCLUDED.teacher_signature_ip,
                    teacher_signed_at = CASE WHEN $7::text = 'FINALIZED' AND evaluations.status != 'FINALIZED' THEN NOW() ELSE evaluations.teacher_signed_at END,
                    updated_at = NOW()
                RETURNING *;
            `;

            const values = [
                conventionId,
                templateId,
                userEmail,
                JSON.stringify(finalAnswers),
                JSON.stringify(finalTutorAnswers),
                synthesis ?? (current ? current.synthesis : null),
                status || (current ? current.status : 'DRAFT'),
                final_grade || (current ? current.final_grade : null),
                signature?.img || (current ? current.teacher_signature_img : null),
                signature?.hash || (current ? current.teacher_signature_hash : null),
                signature?.ip || (current ? current.teacher_signature_ip : null)
            ];

            const result = await client.query(sqlQuery, values);
            const rowCount = result.rowCount ?? 0;
            console.log(`✅ [FORENSIC] SQL UPSERT SUCCESS. Rows affected:`, rowCount);
            if (rowCount > 0) {
                console.log("ID de la ligne en base:", result.rows[0].id);
            } else {
                console.warn("⚠️ [FORENSIC] UPSERT exécuté mais rowCount = 0 !");
            }

            // 4. Synchronize Convention Status
            if (status === 'FINALIZED') {
                await client.query(
                    "UPDATE conventions SET status = 'EVALUATED' WHERE id = $1",
                    [conventionId]
                );
            }

            await client.query('COMMIT');
            return NextResponse.json({ 
                success: true, 
                evaluation: result.rows[0],
                debug: {
                    rowCount,
                    isTutor,
                    isTeacher,
                    conventionId,
                    templateId,
                    receivedAnswersCount: Object.keys(answers || {}).length
                }
            });

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error("Erreur API PATCH /evaluations :", error);
        return NextResponse.json({ error: "Erreur lors de la mise à jour." }, { status: 500 });
    }
}
