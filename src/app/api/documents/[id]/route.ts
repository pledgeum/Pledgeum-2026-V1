import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import pool from '@/lib/pg';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: docId } = await params;
    const userId = (session.user as any).id;

    try {
        // Only allow uploader or admin to delete
        const docCheck = await pool.query('SELECT uploader_id FROM class_documents WHERE id = $1', [docId]);
        if (docCheck.rowCount === 0) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        const isOwner = docCheck.rows[0].uploader_id === userId;
        const isAdmin = (session.user as any).role === 'admin';

        if (!isOwner && !isAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        await pool.query('DELETE FROM class_documents WHERE id = $1', [docId]);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[DOCUMENTS_DELETE] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: docId } = await params;
    const userId = (session.user as any).id;

    try {
        const { isShared, classIds } = await req.json();

        // Check ownership
        const docCheck = await pool.query('SELECT uploader_id FROM class_documents WHERE id = $1', [docId]);
        if (docCheck.rowCount === 0) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        if (docCheck.rows[0].uploader_id !== userId && (session.user as any).role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            if (isShared !== undefined) {
                await client.query('UPDATE class_documents SET is_shared = $1 WHERE id = $2', [isShared, docId]);
            }

            if (classIds !== undefined) {
                await client.query('DELETE FROM document_classes WHERE document_id = $1', [docId]);
                if (classIds.length > 0) {
                    const insertClassesQuery = `
                        INSERT INTO document_classes (document_id, class_name)
                        VALUES ${classIds.map((_: any, i: number) => `($1, $${i + 2})`).join(', ')}
                    `;
                    await client.query(insertClassesQuery, [docId, ...classIds]);
                }
            }

            await client.query('COMMIT');
            return NextResponse.json({ success: true });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error: any) {
        console.error('[DOCUMENTS_PATCH] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
