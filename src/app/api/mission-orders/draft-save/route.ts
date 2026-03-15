import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import pool from '@/lib/pg';

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { assignments } = body; // Map of { convId: { email, distance } }

        if (!assignments || typeof assignments !== 'object') {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            for (const [convId, data] of Object.entries(assignments)) {
                const { email, distance } = data as any;
                
                const upsertQuery = `
                    INSERT INTO visits (
                        convention_id, 
                        draft_tracking_teacher_email, 
                        draft_distance_km,
                        tracking_teacher_email
                    )
                    VALUES (
                        $1::VARCHAR, 
                        $2, 
                        $3, 
                        COALESCE((SELECT tracking_teacher_email FROM visits WHERE convention_id = $1::VARCHAR), 'draft@pending.com')
                    )
                    ON CONFLICT (convention_id) 
                    DO UPDATE SET 
                        draft_tracking_teacher_email = EXCLUDED.draft_tracking_teacher_email, 
                        draft_distance_km = EXCLUDED.draft_distance_km, 
                        updated_at = NOW()
                `;
                await client.query(upsertQuery, [convId, email, distance]);
            }

            await client.query('COMMIT');
            return NextResponse.json({ success: true });

        } catch (dbErr: any) {
            await client.query('ROLLBACK');
            throw dbErr;
        } finally {
            client.release();
        }

    } catch (error: any) {
        console.error("[API_DRAFT_SAVE] Error:", error);
        return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
    }
}
