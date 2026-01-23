
import { NextResponse } from 'next/server';
import pool from '@/lib/pg';

export async function GET(
    req: Request,
    props: { params: Promise<{ classId: string }> }
) {
    let client;
    try {
        const params = await props.params;
        const { classId } = params;

        if (!classId) return NextResponse.json({ error: "Class ID required" }, { status: 400 });

        client = await pool.connect();

        // Fetch students for this class
        // We select fields needed for the Student interface in frontend
        const query = `
            SELECT 
                uid,
                first_name,
                last_name,
                email,
                birth_date,
                is_active
            FROM users 
            WHERE class_id = $1 AND role = 'student'
            ORDER BY last_name, first_name
        `;

        const res = await client.query(query, [classId]);

        const students = res.rows.map(row => ({
            id: row.uid,
            firstName: row.first_name,
            lastName: row.last_name,
            email: row.email || "",
            birthDate: row.birth_date,
            // We map other fields if needed, but this is the core
        }));

        return NextResponse.json({ students });

    } catch (error: any) {
        console.error("[API] GET Class Students Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
        if (client) client.release();
    }
}
