
import { NextResponse } from 'next/server';
import pool from '@/lib/pg';
import { auth } from '@/auth';

export async function GET(request: Request) {
    const session = await auth();
    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const uai = searchParams.get('uai');
    const studentId = searchParams.get('studentId');
    const limit = parseInt(searchParams.get('limit') || '100');

    if (!pool) {
        return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
    }

    const client = await pool.connect();
    try {
        const userEstablishmentUai = (session.user as any).establishment_uai;
        const userRole = (session.user as any).role;

        if (userRole !== 'SUPER_ADMIN' && !userEstablishmentUai) {
            console.error('[API_CONVENTIONS] Security Alert: User has no establishment_uai linked. Returning empty.');
            return NextResponse.json({ success: true, conventions: [], count: 0 });
        }

        // SYSTEMIC FIX: Fetch Live Teacher Data via JOIN (Snapshots are ignored for Teacher Email)
        const queryStr = `
            SELECT 
                c.id,
                c.status,
                c.metadata,
                c.duration_hours as "durationHours",
                TO_CHAR(c.date_start, 'YYYY-MM-DD') as "dateStart",
                TO_CHAR(c.date_end, 'YYYY-MM-DD') as "dateEnd",
                c.validated_at as "validatedAt",
                c.signature_company_at as "signatureCompanyAt",
                c.signature_school_at as "signatureSchoolAt",
                c.tutor_email as "tutorEmail",
                c.tutor_name as "tutorName",
                c.company_siret as "companySiret",
                c.student_uid as "studentId",
                c.establishment_uai as "establishmentUai",
                c.establishment_uai as "schoolId",
                c.class_id as "classId",
                c.pdf_hash as "pdfHash",
                c.rejection_reason as "rejectionReason",
                c.token_company as "tokenCompany",
                c.token_school as "tokenSchool",
                c.created_at as "createdAt",
                c.updated_at as "updatedAt",
                -- LIVE TEACHER DATA
                u.email as "teacherEmail",
                u.first_name as "teacherFirstName",
                u.last_name as "teacherLastName"
            FROM conventions c
            LEFT JOIN classes cls ON c.class_id = cls.id
            LEFT JOIN users u ON cls.main_teacher_id = u.uid
            WHERE 1=1
        `;

        let query = queryStr;
        const params: any[] = [];
        let paramIndex = 1;

        if (userRole !== 'SUPER_ADMIN') {
            query += ` AND c.establishment_uai = $${paramIndex}`;
            params.push(userEstablishmentUai);
            paramIndex++;
        } else if (uai) {
            query += ` AND c.establishment_uai = $${paramIndex}`;
            params.push(uai);
            paramIndex++;
        }

        if (studentId) {
            query += ` AND c.student_uid = $${paramIndex}`;
            params.push(studentId);
            paramIndex++;
        }

        query += ` ORDER BY c.updated_at DESC LIMIT $${paramIndex}`;
        params.push(limit);

        const res = await client.query(query, params);

        const conventions = res.rows.map(c => ({
            ...c,
            signatures: c.metadata?.signatures || {}, // Flatten signatures for frontend compatibility
        }));

        return NextResponse.json({
            success: true,
            conventions: conventions,
            count: res.rowCount
        });

    } catch (error: any) {
        console.error('[API_CONVENTIONS] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    } finally {
        client.release();
    }
}

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { studentId, ...data } = body;

        // Basic validation
        if (!data.ent_nom || !data.dateStart) { // Adjust validation as needed
            // Just a soft check, Schema validation happens on DB constraints or Zod if imported
        }

        // Map frontend camelCase to SnakeCase for DB
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Generate IDs
            const conventionsId = 'conv_' + Math.random().toString(36).substr(2, 9);

            // Insert
            const query = `
                INSERT INTO conventions (
                    id, 
                    student_uid, 
                    status, 
                    created_at, 
                    updated_at,
                    metadata,
                    date_start,
                    date_end
                ) VALUES ($1, $2, 'DRAFT', NOW(), NOW(), $3, $4, $5)
                RETURNING id
            `;
            // We store the specific fields in metadata for now if we don't map them all to columns yet.
            // Critical ones: establishment_uai (from session)
            const uai = (session.user as any).establishment_uai;

            await client.query(query, [
                conventionsId,
                studentId || (session.user as any).id,
                JSON.stringify(data),
                data.dateStart || data.stage_date_debut,
                data.dateEnd || data.stage_date_fin
            ]);

            // Update establishment_uai if available
            if (uai) {
                await client.query('UPDATE conventions SET establishment_uai = $1 WHERE id = $2', [uai, conventionsId]);
            }

            await client.query('COMMIT');

            return NextResponse.json({ success: true, data: { id: conventionsId, ...data, status: 'DRAFT' } });

        } catch (dbError: any) {
            await client.query('ROLLBACK');
            throw dbError;
        } finally {
            client.release();
        }

    } catch (error: any) {
        console.error('Create Convention Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
