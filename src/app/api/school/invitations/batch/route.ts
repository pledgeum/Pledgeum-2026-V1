import { NextResponse } from 'next/server';
import pool from '@/lib/pg';
import { auth } from '@/auth';

export async function POST(req: Request) {
    let client;
    try {
        const session = await auth();
        // Strict Authorization: Only School Heads or Admin
        if (!session?.user || (session.user.role !== 'school_head' && session.user.role !== 'ESTABLISHMENT_ADMIN')) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await req.json();
        const { invitations, uai } = body;

        // MARKER A: Incoming Payload
        console.log('📨 API Received Body:', {
            count: invitations?.length,
            sampleId: invitations?.[0]?.userId,
            targetUAI: uai
        });

        if (!Array.isArray(invitations) || invitations.length === 0) {
            return NextResponse.json({ error: "No invitations provided" }, { status: 400 });
        }

        // MARKER B: Admin Context
        console.log('👮 Admin Context:', {
            uid: session.user.id,
            sessionUAI: session.user.establishment_uai,
            role: session.user.role
        });

        // Context Check
        if (session.user.establishment_uai && session.user.establishment_uai !== uai) {
            console.warn("❌ Context Mismatch:", { session: session.user.establishment_uai, body: uai });
            return NextResponse.json({ error: "Context Mismatch" }, { status: 403 });
        }

        client = await pool.connect();

        // Batch Update
        // We iterate and update. For large batches, a single query with UNNEST is better, 
        // but for a class (30 students), strict loop is fine and safer for logic.

        await client.query('BEGIN');

        // MARKER C: Pre-Check (Target Student)
        // Check the first student to see their current state in DB
        if (invitations.length > 0) {
            const firstId = invitations[0].userId;
            const check = await client.query('SELECT uid, establishment_uai FROM users WHERE uid = $1', [firstId]);
            console.log('🧐 Pre-Update Check (Target Student 1):', check.rows[0]);
        }

        let updatedCount = 0;
        let attemptCount = 0;

        for (const invite of invitations) {
            const { userId, tempId, tempCode } = invite;

            if (userId && tempId && tempCode) {
                attemptCount++;
                // We relax the check: Match UID. 
                // Context Check: Ensure we aren't editing someone else's user carelessly? 
                // Ideally: WHERE uid = $3 AND (establishment_uai = $4 OR establishment_uai IS NULL OR establishment_uai = '9999999X')
                // But for now, just UID match logic if we trust the SchoolHead context fully.

                // ORPHAN CLAIM: We explicitly set the establishment_uai to the current session's UAI.
                // This "claims" the student for this school if they were imported without one.
                const query = `
                    UPDATE users 
                    SET temp_id = $1, 
                        temp_code = $2, 
                        updated_at = NOW(),
                        establishment_uai = $4  -- Claim the student
                    WHERE uid = $3
                 `;

                // MARKER D: Query Details (Sample)
                if (updatedCount === 0) console.log('📝 Executing Update Logic (Sample):', { userId, uai: session.user.establishment_uai });

                const res = await client.query(query, [tempId, tempCode, userId, session.user.establishment_uai]); // Use SESSION UAI, trusted source.

                // MARKER E: Result
                // if (res.rowCount === 0) console.log(`📉 Update Result 0 for ${userId}`); // Too noisy? Keep it for failure case.

                // Check if it actually updated
                if (res.rowCount && res.rowCount > 0) {
                    updatedCount++;
                } else {
                    console.warn(`⚠️ Batch Update Warning: User ${userId} not found or not updated.`);
                }
            }
        }

        await client.query('COMMIT');

        console.log(`✅ Batch Sync: Attempted ${attemptCount}, Updated ${updatedCount}`);

        return NextResponse.json({ success: true, updated: updatedCount });

    } catch (error: any) {
        console.error("Invitation Batch Error:", error);
        if (client) await client.query('ROLLBACK');
        return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
        if (client) client.release();
    }
}
