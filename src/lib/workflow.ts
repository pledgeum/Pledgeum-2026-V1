
import pool from '@/lib/pg';
// import { adminDb } from '@/lib/firebase-admin';
import { randomBytes } from 'crypto';

export type WorkflowStatus =
    | 'DRAFT'
    | 'SUBMITTED'
    | 'SIGNED_PARENT'
    | 'VALIDATED_TEACHER'
    | 'SIGNED_COMPANY'
    | 'SIGNED_TUTOR'
    | 'VALIDATED_HEAD'
    | 'COMPLETED'
    | 'REJECTED'
    | 'ANNULEE'
    | 'CANCELLED';

// Internal Helper to update Status + Sync to Firestore
export async function updateConventionStatus(
    conventionId: string,
    newStatus: WorkflowStatus,
    metadataParts: {
        reason?: string,
        actorId?: string,
        pdfHash?: string,
        signatures?: any, // Generic signatures object to merge
        auditLog?: { // Standardized AuditLog structure
            date: string,
            action: string,
            actorEmail: string,
            details: string,
            ip?: string
        },
        signer?: {
            email: string,
            name: string,
            function: string
        }
    } = {}
) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Fetch current convention context (for UAI, etc.) AND current metadata for safe merging
        const res = await client.query('SELECT establishment_uai, student_uid, metadata FROM conventions WHERE id = $1', [conventionId]);
        if (res.rowCount === 0) throw new Error('Convention not found');
        const { establishment_uai, student_uid, metadata: currentMetadata } = res.rows[0];

        // 2. Prepare Updates
        const updates: any[] = [newStatus, conventionId];
        let query = `
            UPDATE conventions 
            SET status = $1, updated_at = NOW() 
        `;

        let paramIdx = 3; // $1=status, $2=id

        // Safe Metadata Merge Logic (JS Side)
        // We start with current metadata
        let finalMetadata = { ...(currentMetadata || {}) };

        // Merge in signatures if provided (deep merge)
        if (metadataParts.signatures) {
            finalMetadata.signatures = {
                ...(finalMetadata.signatures || {}),
                ...metadataParts.signatures
            };
        }

        // Handle Audit Logs
        if (metadataParts.auditLog) {
            finalMetadata.auditLogs = [
                ...(finalMetadata.auditLogs || []),
                metadataParts.auditLog
            ];
        }

        // Handle transitions & specific fields
        if (newStatus === 'VALIDATED_TEACHER') { // Was VALIDATED_BY_PP
            const tokenCompany = randomBytes(32).toString('hex');
            query += `, validated_at = NOW(), token_company = $${paramIdx++} `;
            updates.push(tokenCompany);
        }
        else if (newStatus === 'SIGNED_COMPANY') {
            const tokenSchool = randomBytes(32).toString('hex');
            query += `, signature_company_at = NOW(), token_school = $${paramIdx++} `;
            updates.push(tokenSchool);
        }
        else if (newStatus === 'VALIDATED_HEAD') { // Was SIGNED_BY_SCHOOL
            query += `, signature_school_at = NOW() `;

            // Update PDF Hash if provided (Final Seal)
            if (metadataParts.pdfHash) {
                query += `, pdf_hash = $${paramIdx++} `;
                updates.push(metadataParts.pdfHash);
            }

            // Capture Signer Identity (Principal)
            if (metadataParts.signer) {
                finalMetadata.signatories = {
                    ...(finalMetadata.signatories || {}),
                    principal: metadataParts.signer
                };
            }
        }
        else if (newStatus === 'REJECTED') {
            query += `, rejection_reason = $${paramIdx++} `;
            updates.push(metadataParts.reason || 'No reason provided');
        }

        // Apply Final Metadata Update
        query += `, metadata = $${paramIdx++}::jsonb `;
        updates.push(JSON.stringify(finalMetadata));

        query += ` WHERE id = $2 RETURNING *`;

        // 3. Execute PG Update
        const updateRes = await client.query(query, updates);
        const updatedRow = updateRes.rows[0];

        await client.query('COMMIT');
        return updatedRow;

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Workflow Transition Failed:", error);
        throw error;
    } finally {
        client.release();
    }
}
