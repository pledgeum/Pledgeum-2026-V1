import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import pool from '@/lib/pg';

// GET /api/notifications
// Fetches the current user's notifications.
export async function GET(req: Request) {
    let client;
    try {
        const session = await auth();
        if (!session || !session.user || !session.user.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userEmail = session.user.email;
        client = await pool.connect();

        const res = await client.query(`
            SELECT 
                id, 
                title, 
                message, 
                action_label AS "actionLabel", 
                action_link AS "actionLink", 
                read, 
                created_at AS date
            FROM notifications
            WHERE recipient_email = $1
            ORDER BY created_at DESC
            LIMIT 50
        `, [userEmail]);

        return NextResponse.json(res.rows, { status: 200 });
    } catch (error: any) {
        console.error('Error fetching notifications:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    } finally {
        if (client) client.release();
    }
}

// DELETE /api/notifications
// Deletes ALL notifications for the current user.
export async function DELETE(req: Request) {
    let client;
    try {
        const session = await auth();
        if (!session || !session.user || !session.user.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userEmail = session.user.email;
        client = await pool.connect();

        await client.query(`
            DELETE FROM notifications
            WHERE recipient_email = $1
        `, [userEmail]);

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error: any) {
        console.error('Error deleting notifications:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    } finally {
        if (client) client.release();
    }
}
