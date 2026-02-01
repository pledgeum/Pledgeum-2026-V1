
import { NextResponse } from 'next/server';
import pool from '@/lib/pg';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ classId: string }> } // Fix: Type params as Promise
) {
    const { classId } = await params; // Fix: Await params

    if (!classId) return NextResponse.json({ error: 'Missing Class ID' }, { status: 400 });

    const client = await pool.connect();
    try {
        const query = `
            SELECT uid, first_name, last_name, email, birth_date, establishment_uai
            FROM users 
            WHERE class_id = $1 AND role = 'student'
            ORDER BY last_name, first_name
        `;
        const res = await client.query(query, [classId]);

        const students = res.rows.map(row => ({
            id: row.uid,
            firstName: row.first_name,
            lastName: row.last_name,
            email: row.email,
            birthDate: row.birth_date,
            ine: null // TODO: Add INE column if needed
        }));

        return NextResponse.json({ students });

    } catch (error: any) {
        console.error('Error fetching class students:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
        client.release();
    }
}
