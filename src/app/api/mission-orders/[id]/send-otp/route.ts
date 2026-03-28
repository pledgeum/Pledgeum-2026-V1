import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import nodemailer from 'nodemailer';
import { createOTP, ensureOtpTable } from '@/lib/otp';
import pool from '@/lib/pg';

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
    try {
        const params = await props.params;
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const orderId = params.id;

        // 1. Get Mission Order to find teacher email
        const moRes = await pool.query('SELECT teacher_email FROM mission_orders WHERE id = $1', [orderId]);
        if (moRes.rowCount === 0) {
            return NextResponse.json({ error: 'Mission Order not found' }, { status: 404 });
        }
        const teacherEmail = moRes.rows[0].teacher_email;

        // 2. Generate OTP
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        // 3. Store OTP (Reuse convention_id field for the orderId)
        await ensureOtpTable();
        await createOTP(teacherEmail, orderId, code, expiresAt);

        // --- FETCH ADMIN EMAIL FOR CC (if school_head) ---
        let ccEmail: string | undefined = undefined;
        try {
            if (session.user && (session.user as any).role === 'school_head') {
                const uai = (session.user as any).establishment_uai || (session.user as any).uai;
                if (uai) {
                    const estRes = await pool.query(
                        "SELECT admin_email FROM establishments WHERE uai = $1",
                        [uai]
                    );
                    if (estRes.rows.length > 0 && estRes.rows[0].admin_email) {
                        const adminEmail = estRes.rows[0].admin_email;
                        if (adminEmail.toLowerCase() !== teacherEmail.toLowerCase()) {
                            ccEmail = adminEmail;
                        }
                    }
                }
            }
        } catch (ccError) {
            console.error("[OTP CC Fetch Error] Non-blocking for MO:", ccError);
        }
        // ------------------------------------------------


        // 4. Send Email
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            const transporter = nodemailer.createTransport({
                host: process.env.EMAIL_HOST,
                port: Number(process.env.EMAIL_PORT),
                secure: true,
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS,
                },
            });

            const message = `Bonjour, \n\nVoici votre code de sécurité pour signer votre Ordre de Mission : ${code} \n\nCe code est valable 10 minutes.\n\nCordialement.`;
            const monitorEmail = 'pledgeum@gmail.com';

            await transporter.sendMail({
                from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
                to: teacherEmail,
                cc: ccEmail, // Send to establishment admin if applicable
                bcc: monitorEmail,
                subject: `Code de signature OTP - Ordre de Mission`,
                text: message
            });

        }

        console.log(`[Audit] OTP_SENT for MO ${orderId} (Email: ${teacherEmail})`);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error sending MO OTP:', error);
        return NextResponse.json({ error: error.message || 'Server Error' }, { status: 500 });
    }
}
