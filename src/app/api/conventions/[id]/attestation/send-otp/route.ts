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

        const conventionId = params.id;

        // 1. Get Convention to find signee email (Tutor or Company Head)
        const convRes = await pool.query('SELECT tutor_email, metadata FROM conventions WHERE id = $1', [conventionId]);
        if (convRes.rowCount === 0) {
            return NextResponse.json({ error: 'Convention not found' }, { status: 404 });
        }

        const convention = convRes.rows[0];
        const tutorEmail = convention.tutor_email;
        const companyHeadEmail = convention.metadata?.ent_rep_email;

        const recipientEmail = tutorEmail || companyHeadEmail;

        if (!recipientEmail) {
            return NextResponse.json({ error: 'Aucun email de tuteur ou de représentant trouvé pour cette convention.' }, { status: 400 });
        }

        // 2. Generate OTP
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        // 3. Store OTP
        await ensureOtpTable();
        await createOTP(recipientEmail, conventionId, code, expiresAt);

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

            const message = `Bonjour, \n\nVoici votre code de sécurité pour signer l'Attestation de PFMP : ${code} \n\nCe code est valable 10 minutes.\n\nCordialement.`;
            const monitorEmail = 'pledgeum@gmail.com';

            await transporter.sendMail({
                from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
                to: recipientEmail,
                bcc: monitorEmail,
                subject: `Code de signature OTP - Attestation de PFMP`,
                text: message
            });
        }

        console.log(`[Audit] OTP_SENT for Attestation ${conventionId} (Email: ${recipientEmail})`);

        return NextResponse.json({ success: true, email: recipientEmail });
    } catch (error: any) {
        console.error('Error sending Attestation OTP:', error);
        return NextResponse.json({ error: error.message || 'Server Error' }, { status: 500 });
    }
}
