import { NextResponse } from 'next/server';
import pool from '@/lib/pg';
import { auth } from '@/auth';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { id } = await params;

    try {
        const result = await pool.query(
            'SELECT * FROM attestations WHERE convention_id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return NextResponse.json({ success: true, attestation: null });
        }

        return NextResponse.json({ success: true, attestation: result.rows[0] });
    } catch (error) {
        console.error(`[API] Error fetching attestation for convention ${id}:`, error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    try {
        const {
            total_days_paid,
            total_weeks_diploma,
            absences_hours,
            activities,
            skills_evaluation,
            gratification_amount,
            signer_name,
            signer_function,
            signature_date,
            signature_img,
            signature_code,
            pdf_hash,
            audit_logs
        } = body;

        // Upsert logic
        const query = `
            INSERT INTO attestations (
                convention_id, total_days_paid, total_weeks_diploma, absences_hours, activities, 
                skills_evaluation, gratification_amount, signer_name, signer_function, 
                signature_date, signature_img, signature_code, pdf_hash, audit_logs
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (convention_id) DO UPDATE SET
                total_days_paid = EXCLUDED.total_days_paid,
                total_weeks_diploma = EXCLUDED.total_weeks_diploma,
                absences_hours = EXCLUDED.absences_hours,
                activities = EXCLUDED.activities,
                skills_evaluation = EXCLUDED.skills_evaluation,
                gratification_amount = EXCLUDED.gratification_amount,
                signer_name = EXCLUDED.signer_name,
                signer_function = EXCLUDED.signer_function,
                signature_date = EXCLUDED.signature_date,
                signature_img = EXCLUDED.signature_img,
                signature_code = EXCLUDED.signature_code,
                pdf_hash = EXCLUDED.pdf_hash,
                audit_logs = EXCLUDED.audit_logs,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *;
        `;

        const values = [
            id,
            total_days_paid || 0,
            total_weeks_diploma || 0,
            absences_hours || 0,
            activities || '',
            skills_evaluation || '',
            gratification_amount || '0',
            signer_name || '',
            signer_function || '',
            signature_date || new Date().toISOString(),
            signature_img || '',
            signature_code || '',
            pdf_hash || '',
            JSON.stringify(audit_logs || [])
        ];

        const result = await pool.query(query, values);

        return NextResponse.json({ success: true, attestation: result.rows[0] });
    } catch (error) {
        console.error(`[API] Error upserting attestation for convention ${id}:`, error);
        return NextResponse.json({ error: "Erreur serveur lors de la sauvegarde" }, { status: 500 });
    }
}
