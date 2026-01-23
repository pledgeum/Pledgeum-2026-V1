
import { NextResponse } from 'next/server';
import pool from '@/lib/pg';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const uai = searchParams.get('uai'); // Filter by School (for Admin/Teacher)
    const studentId = searchParams.get('studentId'); // Filter by Student
    const email = searchParams.get('email'); // Fallback/Debug
    const limit = parseInt(searchParams.get('limit') || '100');

    if (!pool) {
        return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
    }

    const client = await pool.connect();
    try {
        const SELECT_FIELDS = `
            id,
            status,
            metadata,
            duration_hours as "durationHours",
            date_start as "dateStart",
            date_end as "dateEnd",
            validated_at as "validatedAt",
            signature_company_at as "signatureCompanyAt",
            signature_school_at as "signatureSchoolAt",
            tutor_email as "tutorEmail",
            tutor_name as "tutorName",
            company_siret as "companySiret",
            student_uid as "studentId",
            establishment_uai as "establishmentUai",
            establishment_uai as "schoolId",
            class_id as "classId",
            pdf_hash as "pdfHash",
            rejection_reason as "rejectionReason",
            token_company as "tokenCompany",
            token_school as "tokenSchool",
            created_at as "createdAt",
            updated_at as "updatedAt"
        `;

        let query = `SELECT ${SELECT_FIELDS} FROM conventions WHERE 1=1`;
        const params: any[] = [];
        let paramIndex = 1;

        if (uai) {
            query += ` AND establishment_uai = $${paramIndex}`;
            params.push(uai);
            paramIndex++;
        }

        if (studentId) {
            query += ` AND student_uid = $${paramIndex}`;
            params.push(studentId);
            paramIndex++;
        }

        // If specific email provided (e.g. for Tutor lookup?), handle logic if needed.
        // For now, primary filters are UAI and StudentID.

        query += ` ORDER BY updated_at DESC LIMIT $${paramIndex}`;
        params.push(limit);

        const res = await client.query(query, params);

        return NextResponse.json({
            success: true,
            conventions: res.rows,
            count: res.rowCount
        });

    } catch (error: any) {
        console.error('[API_CONVENTIONS] Error:', error);
        return NextResponse.json({
            error: 'Internal Server Error',
            details: error.message
        }, { status: 500 });
    } finally {
        client.release();
    }
}
