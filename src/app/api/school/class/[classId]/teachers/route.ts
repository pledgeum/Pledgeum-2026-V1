
import { NextResponse } from 'next/server';
import pool from '@/lib/pg';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ classId: string }> }
) {
    const { classId } = await params;

    if (!classId) return NextResponse.json({ error: 'Missing Class ID' }, { status: 400 });

    const client = await pool.connect();
    try {
        const query = `
            SELECT 
                u.uid, u.first_name, u.last_name, u.email, u.prox_commune as preferred_commune
            FROM teacher_assignments ta
            JOIN users u ON ta.teacher_uid = u.uid
            WHERE ta.class_id = $1
            ORDER BY u.last_name, u.first_name
        `;
        const res = await client.query(query, [classId]);

        const teachers = res.rows.map(row => ({
            id: row.uid,
            firstName: row.first_name,
            lastName: row.last_name,
            email: row.email,
            preferredCommune: row.preferred_commune
        }));

        return NextResponse.json({ teachers });

    } catch (error: any) {
        console.error('Error fetching class teachers:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
        client.release();
    }
}
