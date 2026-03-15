import { NextResponse } from 'next/server';
import pool from '@/lib/pg';
import { auth } from '@/auth';
import crypto from 'crypto';

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: conventionId } = await params;
        const body = await req.json();
        const { signatureImage, code: providedCode, auditLog: providedAuditLog } = body;

        // Auto-generate code if missing
        const code = providedCode || `ATT-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
        const now = new Date().toISOString();

        const getIp = (req: Request) => {
            const clientIp = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
            return clientIp === '::1' ? '127.0.0.1 (Localhost)' : clientIp;
        };
        const ip = getIp(req);

        const hashInput = `${conventionId}:attestation:${now}:${code}`;
        const signatureHash = crypto.createHash('sha256').update(hashInput).digest('hex');

        // Audit log
        const auditLogEntry = providedAuditLog || {
            date: now,
            action: 'SIGNED',
            actorEmail: session.user.email || 'unknown',
            details: 'Signature Attestation PFMP',
            ip: ip
        };

        // Update the attestation table
        const query = `
            UPDATE attestations 
            SET 
                signature_date = $1,
                signature_img = $2,
                signature_code = $3,
                pdf_hash = $4,
                audit_logs = audit_logs || $5::jsonb,
                updated_at = CURRENT_TIMESTAMP
            WHERE convention_id = $6
            RETURNING *;
        `;

        const values = [
            now,
            signatureImage,
            code,
            signatureHash,
            JSON.stringify([auditLogEntry]),
            conventionId
        ];

        const result = await pool.query(query, values);

        if (result.rowCount === 0) {
            // If no record exists, maybe we should create it first? 
            // Usually it's created during draft saving.
            return NextResponse.json({ error: 'Attestation non trouvée. Veuillez enregistrer le brouillon d\'abord.' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error: any) {
        console.error('Sign Attestation Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
