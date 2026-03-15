import { NextResponse } from 'next/server';
import pool from '@/lib/pg';
import { auth } from '@/auth';

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
    try {
        const params = await props.params;
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const orderId = params.id;
        const body = await req.json();
        const { signatureImg, signerName, role } = body;

        const date = new Date().toISOString();
        const hash = `ODM-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        const signatureData = { img: signatureImg, signerName, hash, date };

        // Determine target field based on role (default to head for this route)
        const targetField = role === 'teacher' ? 'teacher' : 'head';

        const query = `
            UPDATE mission_orders 
            SET signature_data = jsonb_set(
                    COALESCE(signature_data, '{}'::jsonb), 
                    '{${targetField}}', 
                    $1::jsonb
                ),
                status = CASE 
                    WHEN (
                        (jsonb_set(COALESCE(signature_data, '{}'::jsonb), '{${targetField}}', $1::jsonb) ? 'teacher') AND 
                        (jsonb_set(COALESCE(signature_data, '{}'::jsonb), '{${targetField}}', $1::jsonb) ? 'head')
                    ) THEN 'SIGNED' 
                    ELSE 'PENDING' 
                END,
                updated_at = NOW()
            WHERE id = $2
            RETURNING *;
        `;
        const res = await pool.query(query, [JSON.stringify(signatureData), orderId]);

        if (res.rowCount === 0) return NextResponse.json({ error: 'Mission Order not found' }, { status: 404 });

        return NextResponse.json({ success: true, date, hash });
    } catch (err: any) {
        console.error(err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
