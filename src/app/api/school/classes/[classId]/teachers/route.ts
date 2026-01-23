
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

        // Fetch teachers for this class via teacher_assignments
        const query = `
            SELECT 
                u.uid,
                u.first_name,
                u.last_name,
                u.email
            FROM users u
            JOIN teacher_assignments ta ON u.uid = ta.teacher_uid
            WHERE ta.class_id = $1
            ORDER BY u.last_name, u.first_name
        `;

        const res = await client.query(query, [classId]);

        const teachers = res.rows.map(row => ({
            id: row.uid,
            firstName: row.first_name,
            lastName: row.last_name,
            email: row.email || ""
        }));

        return NextResponse.json({ teachers });

    } catch (error: any) {
        console.error("[API] GET Class Teachers Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
        if (client) client.release();
    }
}
