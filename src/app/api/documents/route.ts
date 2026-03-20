import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import pool from '@/lib/pg';

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    const { role, establishment_uai, id: userId } = user;

    const { searchParams } = new URL(req.url);
    const classFilter = searchParams.get('classId');

    try {
        let query = `
            SELECT cd.id, cd.uploader_id as "uploadedBy", cd.school_id as "schoolName", cd.file_name as name, cd.file_data as url, cd.is_shared as "sharedWithSchool", cd.created_at as "createdAt",
                   COALESCE(array_agg(dc.class_name) FILTER (WHERE dc.class_name IS NOT NULL), '{}') as classes,
                   CONCAT(u.first_name, ' ', u.last_name) as "sharedBy"
            FROM class_documents cd
            LEFT JOIN document_classes dc ON cd.id = dc.document_id
            LEFT JOIN users u ON cd.uploader_id = u.uid
        `;
        const params: any[] = [];
        const whereClauses: string[] = [];

        // Role-based filtering
        const adminRoles = ['admin', 'school_head', 'ddfpt', 'at_ddfpt', 'business_manager', 'ESTABLISHMENT_ADMIN', 'SUPER_ADMIN'];
        if (adminRoles.includes(role)) {
            whereClauses.push(`cd.school_id = $${params.length + 1}`);
            params.push(establishment_uai);
        } else if (role === 'teacher' || role === 'main_teacher') {
            whereClauses.push(`(cd.uploader_id = $${params.length + 1} OR (cd.school_id = $${params.length + 2} AND cd.is_shared = true))`);
            params.push(userId, establishment_uai);
        } else if (role === 'student' || role === 'parent') {
            // Students/Parents see shared docs or docs assigned to classes in their school
            // For now, limited to school-level + sharing/assignment
            whereClauses.push(`cd.school_id = $${params.length + 1} AND (cd.is_shared = true OR dc.class_name IS NOT NULL)`);
            params.push(establishment_uai);
        } else {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (whereClauses.length > 0) {
            query += " WHERE " + whereClauses.join(" AND ");
        }

        query += ` GROUP BY cd.id, u.first_name, u.last_name ORDER BY cd.created_at DESC`;

        const result = await pool.query(query, params);

        // Apply class filter if provided
        let documents = result.rows;
        if (classFilter) {
            documents = documents.filter((doc: any) =>
                doc.classes.includes(classFilter) || doc.sharedWithSchool
            );
        }

        documents = documents.map(row => ({
            ...row,
            url: row.url.startsWith('data:') ? row.url : `data:application/pdf;base64,${row.url}`,
            classIds: row.classes.filter((id: any) => id !== null),
            type: 'OTHER' // Default type as requested
        }));

        return NextResponse.json(documents);
    } catch (error: any) {
        console.error('[DOCUMENTS_GET] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    const { role, establishment_uai, id: userId } = user;

    const allowedRoles = ['admin', 'teacher', 'main_teacher', 'ddfpt', 'at_ddfpt', 'school_head', 'ESTABLISHMENT_ADMIN', 'SUPER_ADMIN'];
    if (!allowedRoles.includes(role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const { fileName, fileData, sizeBytes, isShared, classIds } = await req.json();

        // Validation
        if (!fileName.toLowerCase().endsWith('.pdf')) {
            return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 });
        }
        if (sizeBytes > 500 * 1024) {
            return NextResponse.json({ error: 'File size exceeds 500KB' }, { status: 400 });
        }

        // Strip data prefix if present
        const pureBase64 = fileData.split(',').pop();

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const insertDocQuery = `
                INSERT INTO class_documents (uploader_id, school_id, file_name, file_data, size_bytes, is_shared)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id
            `;
            const docResult = await client.query(insertDocQuery, [userId, establishment_uai, fileName, pureBase64, sizeBytes, isShared || false]);
            const documentId = docResult.rows[0].id;

            if (classIds && classIds.length > 0) {
                const insertClassesQuery = `
                    INSERT INTO document_classes (document_id, class_name)
                    VALUES ${classIds.map((_: any, i: number) => `($1, $${i + 2})`).join(', ')}
                `;
                await client.query(insertClassesQuery, [documentId, ...classIds]);
            }

            await client.query('COMMIT');
            return NextResponse.json({ id: documentId, success: true });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error: any) {
        console.error('[DOCUMENTS_POST] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
