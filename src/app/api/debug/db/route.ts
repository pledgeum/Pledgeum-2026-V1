import { NextResponse } from 'next/server';
import pool from '@/lib/pg';

export async function GET() {
    let client;
    try {
        client = await pool.connect();
        const res = await client.query('SELECT COUNT(*) FROM conventions');
        const maxRes = await client.query('SELECT MAX(created_at) FROM conventions');
        const dbUrl = process.env.DATABASE_URL?.substring(0, 30) + '...'; // mask password
        return NextResponse.json({
            count: res.rows[0].count,
            latest: maxRes.rows[0].max,
            maskedDbUrl: dbUrl,
            envVars: Object.keys(process.env).filter(k => k.includes('POSTGRES') || k.includes('DATABASE'))
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
        if (client) client.release();
    }
}
