import { NextResponse } from 'next/server';
import pool from '@/lib/pg';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const uai = searchParams.get('uai');

    if (!uai) {
        return NextResponse.json({ error: "UAI required" }, { status: 400 });
    }

    let client;
    try {
        client = await pool.connect();

        // Optimized query to fetch ALL teacher assignments for the entire establishment
        const res = await client.query(`
            SELECT 
                ta.class_id as "classId",
                u.uid as "id",
                u.first_name as "firstName",
                u.last_name as "lastName",
                u.email,
                u.prox_commune as "preferredCommune"
            FROM teacher_assignments ta
            JOIN users u ON ta.teacher_uid = u.uid
            WHERE u.establishment_uai = $1
            ORDER BY ta.class_id, u.last_name, u.first_name
        `, [uai]);

        // Group by classId for efficient processing on frontend
        const assignments = res.rows.reduce((acc: any, row: any) => {
            const { classId, ...teacher } = row;
            if (!acc[classId]) acc[classId] = [];
            acc[classId].push(teacher);
            return acc;
        }, {});

        return NextResponse.json({ assignments });

    } catch (err: any) {
        console.error("[API] Bulk Assignments Fetch Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    } finally {
        if (client) client.release();
    }
}
