import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import pool from '@/lib/pg';

// PATCH /api/notifications/[id]/read
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    let client;
    try {
        const session = await auth();
        if (!session || !session.user || !session.user.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const resolvedParams = await params;
        const notificationId = resolvedParams.id;
        const userEmail = session.user.email;

        client = await pool.connect();

        // Security: Ensure the notification belongs to this user
        const res = await client.query(`
            UPDATE notifications
            SET read = true
            WHERE id = $1 AND recipient_email = $2
            RETURNING id
        `, [notificationId, userEmail]);

        if (res.rowCount === 0) {
            return NextResponse.json({ error: 'Notification not found or access denied' }, { status: 404 });
        }

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error: any) {
        console.error('Error marking notification as read:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    } finally {
        if (client) client.release();
    }
}
