import { NextResponse } from 'next/server';
import pool from '@/lib/pg';
import { auth } from '@/auth';

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { conventionId, teacherId, studentId, schoolAddress, companyAddress, distanceKm } = body;

        if (!conventionId || !teacherId) {
            return NextResponse.json({ error: 'Missing conventionId or teacherId' }, { status: 400 });
        }

        const query = `
            INSERT INTO mission_orders (convention_id, teacher_email, student_id, school_address, company_address, distance_km, status)
            VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
            ON CONFLICT (convention_id) DO UPDATE SET
                teacher_email = EXCLUDED.teacher_email,
                student_id = EXCLUDED.student_id,
                school_address = EXCLUDED.school_address,
                company_address = EXCLUDED.company_address,
                distance_km = EXCLUDED.distance_km,
                status = 'PENDING',
                signature_data = COALESCE(mission_orders.signature_data, '{}'::jsonb) - 'teacher',
                updated_at = NOW()
            RETURNING *;
        `;
        const values = [conventionId, teacherId, studentId || '', schoolAddress || '', companyAddress || '', distanceKm || 0];
        const res = await pool.query(query, values);

        const dbRecord = res.rows[0];
        return NextResponse.json({
            id: dbRecord.id,
            conventionId: dbRecord.convention_id,
            teacherId: dbRecord.teacher_email,
            studentId: dbRecord.student_id,
            schoolAddress: dbRecord.school_address,
            companyAddress: dbRecord.company_address,
            distanceKm: parseFloat(dbRecord.distance_km),
            status: dbRecord.status,
            createdAt: dbRecord.created_at
        });
    } catch (err: any) {
        console.error(err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const query = `SELECT * FROM mission_orders`;
        const res = await pool.query(query);

        const orders = res.rows.map(dbRecord => ({
            id: dbRecord.id,
            conventionId: dbRecord.convention_id,
            teacherId: dbRecord.teacher_email,
            studentId: dbRecord.student_id,
            schoolAddress: dbRecord.school_address,
            companyAddress: dbRecord.company_address,
            distanceKm: dbRecord.distance_km ? parseFloat(dbRecord.distance_km) : 0,
            status: dbRecord.status,
            signature_data: dbRecord.signature_data,
            createdAt: dbRecord.created_at
        }));

        return NextResponse.json(orders);
    } catch (err: any) {
        console.error(err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
