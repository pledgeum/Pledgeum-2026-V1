
import pool from '@/lib/pg';
import { adminDb } from '@/lib/firebase-admin';
import { randomBytes } from 'crypto';

export type WorkflowStatus =
    | 'DRAFT'
    | 'SUBMITTED'
    | 'VALIDATED_BY_PP'
    | 'SIGNED_BY_COMPANY'
    | 'SIGNED_BY_SCHOOL'
    | 'COMPLETED'
    | 'REJECTED';

// Internal Helper to update Status + Sync to Firestore
export async function updateConventionStatus(
    conventionId: string,
    newStatus: WorkflowStatus,
    metadata: {
        reason?: string,
        actorId?: string,
        pdfHash?: string,
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

        // 1. Fetch current convention context (for UAI, etc.)
        const res = await client.query('SELECT establishment_uai, student_uid FROM conventions WHERE id = $1', [conventionId]);
        if (res.rowCount === 0) throw new Error('Convention not found');
        const { establishment_uai, student_uid } = res.rows[0];

        // 2. Prepare Updates
        const updates: any[] = [newStatus, conventionId];
        let query = `
            UPDATE conventions 
            SET status = $1, updated_at = NOW() 
        `;

        let paramIdx = 3; // $1=status, $2=id

        // Handle transitions
        if (newStatus === 'VALIDATED_BY_PP') {
            const tokenCompany = randomBytes(32).toString('hex');
            query += `, validated_at = NOW(), token_company = $${paramIdx++}, pdf_hash = $${paramIdx++} `;
            updates.push(tokenCompany);
            updates.push(metadata.pdfHash || null);
            // Email Logic would be triggered here (MessageQueue or direct call)
        }
        else if (newStatus === 'SIGNED_BY_COMPANY') {
            const tokenSchool = randomBytes(32).toString('hex');
            query += `, signature_company_at = NOW(), token_school = $${paramIdx++} `;
            updates.push(tokenSchool);
        }
        else if (newStatus === 'SIGNED_BY_SCHOOL' || newStatus === 'COMPLETED' || newStatus === 'VALIDATED_HEAD') {
            query += `, signature_school_at = NOW() `;

            // Update PDF Hash if provided (Final Seal)
            if (metadata.pdfHash) {
                query += `, pdf_hash = $${paramIdx++} `;
                updates.push(metadata.pdfHash);
            }

            // [NEW] Capture Signer Identity if provided
            if (metadata.signer) {
                // We use jsonb_set or || to merge.
                // safe way: metadata = COALESCE(metadata, '{}'::jsonb) || $PARAM
                query += `, metadata = COALESCE(metadata, '{}'::jsonb) || $${paramIdx++}::jsonb `;
                updates.push(JSON.stringify({
                    signatories: {
                        principal: metadata.signer
                    }
                }));
            }
        }
        else if (newStatus === 'REJECTED') {
            query += `, rejection_reason = $${paramIdx++} `;
            updates.push(metadata.reason || 'No reason provided');
        }

        query += ` WHERE id = $2 RETURNING *`;

        // 3. Execute PG Update
        const updateRes = await client.query(query, updates);
        const updatedRow = updateRes.rows[0];

        // 4. Mirror to Firestore
        // Path: establishments/{uai}/conventions/{id} (or student path?)
        // ConventionStore usually listens to `establishments/{uai}/conventions` ?
        // Or `users/{uid}/conventions`?
        // Let's assume typical path: `conventions/{id}` if root, or `establishments/{uai}/conventions/{id}`.
        // Based on `firestore.rules`, conventions are at root `/conventions/{id}`.
        // Wait, check rules line 54 `match /conventions/{conventionId}`. Yes DB Root.

        const docRef = adminDb.collection('conventions').doc(conventionId);
        await docRef.set({
            status: newStatus,
            updatedAt: new Date().toISOString(),
            // Sync specific fields if needed for UI
            pdfHash: updatedRow.pdf_hash || null,
            rejectionReason: updatedRow.rejection_reason || null,
            signatures: {
                companyAt: updatedRow.signature_company_at,
                schoolAt: updatedRow.signature_school_at,
                validatedAt: updatedRow.validated_at
            }
        }, { merge: true });

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
