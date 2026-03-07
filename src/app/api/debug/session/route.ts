
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import pool from '@/lib/pg';

export async function GET() {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'No session' });

    let dbData = null;
    if (session.user?.email) {
        const client = await pool.connect();
        try {
            const res = await client.query('SELECT uid, email, role, establishment_uai FROM users WHERE email = $1', [session.user.email]);
            dbData = res.rows[0];
        } finally {
            client.release();
        }
    }

    return NextResponse.json({
        session: {
            user: session.user,
            expires: session.expires
        },
        database: dbData,
        emailChecked: session.user?.email
    });
}
