import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/auth';
import { verifyOTP } from '@/lib/otp';
import pool from '@/lib/pg';

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
    try {
        const params = await props.params;
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const orderId = params.id;
        const body = await req.json();
        const { email, code, signerName, role } = body;

        if (!email || !code) {
            return NextResponse.json({ error: 'Email et code requis' }, { status: 400 });
        }

        // 1. Verify OTP
        const verification = await verifyOTP(email, code);
        if (!verification.valid) {
            return NextResponse.json({ error: 'Code invalide ou expiré' }, { status: 400 });
        }

        // 2. Prepare Signature Data
        const date = new Date().toISOString();
        const hash = `ODM-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

        // Use a generic signature image for OTP-authenticated users
        // similar to what is generated in the frontend for conventions
        const signatureData = {
            signerName,
            hash,
            date,
            method: 'OTP',
            verifiedEmail: email
        };

        const headersList = await headers();
        const ip = headersList.get('x-forwarded-for') || 'unknown';

        // 3. Update Mission Order
        // Determine the target field based on role (default to teacher for safety if not provided)
        const targetField = role === 'head' ? 'head' : 'teacher';

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

        if (res.rowCount === 0) {
            return NextResponse.json({ error: 'Mission Order not found' }, { status: 404 });
        }

        console.log(`[Audit] OTP_VERIFIED and MO_SIGNED for ${orderId} (Email: ${email}, IP: ${ip})`);

        return NextResponse.json({
            success: true,
            hash,
            date,
            auditLog: {
                timestamp: date,
                verified: true,
                method: 'otp',
                email,
                ip
            }
        });
    } catch (error: any) {
        console.error('Error verifying MO OTP:', error);
        return NextResponse.json({ error: error.message || 'Server Error' }, { status: 500 });
    }
}
