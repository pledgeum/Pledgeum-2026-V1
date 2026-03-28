import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { checkRateLimit, validateOrigin, verifyUserSession } from '@/lib/server-security';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import { createOTP, ensureOtpTable } from '@/lib/otp';
import pool from '@/lib/pg';

// Schema Validation
const otpSchema = z.object({
    email: z.string().email("Email invalide"),
    conventionId: z.string().min(1, "ID Convention requis")
});

export async function POST(request: Request) {
    let step = 'Init';
    try {
        // 0. Security Checks
        const isAllowedOrigin = validateOrigin(request);
        if (!isAllowedOrigin) return NextResponse.json({ error: 'Origin not allowed' }, { status: 403 });

        const isRateLimited = !await checkRateLimit(request, 'otp-send');
        if (isRateLimited) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });


        step = 'Input Parse';
        const body = await request.json();
        const validation = otpSchema.safeParse(body);

        if (!validation.success) {
            const issues = validation.error.issues;
            return NextResponse.json({ error: issues[0]?.message || "Données invalides" }, { status: 400 });
        }

        const { email, conventionId } = validation.data;
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        // 10 minutes expiry
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        step = 'DB Write OTP';
        await ensureOtpTable(); // Ensure table exists
        await createOTP(email, conventionId, code, expiresAt);

        step = 'DB Write Notification';
        // Insert notification into Postgres (requires notifications table or just skip if not critical?)
        // Store user has "notifications currently disabled". So I can skip or log.
        // Or using pool to insert?
        // Let's Skip Notification persistence for now to focus on OTP flow.
        console.log(`[Notification] Would save notification for ${email}: OTP ${code}`);

        // --- FETCH ADMIN EMAIL FOR CC (if school_head) ---
        let ccEmail: string | undefined = undefined;
        try {
            const currentUser = await verifyUserSession(request);
            if (currentUser && (currentUser as any).role === 'school_head') {
                const uai = (currentUser as any).establishment_uai || (currentUser as any).uai;

                if (uai) {
                    const estRes = await pool.query(
                        "SELECT admin_email FROM establishments WHERE uai = $1",
                        [uai]
                    );
                    if (estRes.rows.length > 0 && estRes.rows[0].admin_email) {
                        const adminEmail = estRes.rows[0].admin_email;
                        if (adminEmail.toLowerCase() !== email.toLowerCase()) {
                            ccEmail = adminEmail;
                        }
                    }
                }
            }
        } catch (ccError) {
            console.error("[OTP CC Fetch Error] Non-blocking:", ccError);
        }
        // ------------------------------------------------


        step = 'Email Transport Init';
        // ... (email sending code remains same)
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

            const message = `Bonjour, \n\nVoici votre code de sécurité pour signer la convention: ${code} \n\nCe code est valable 10 minutes.\n\nCordialement.`;
            const monitorEmail = 'pledgeum@gmail.com';

            step = 'Email Sending';
            // Explicitly cast to any or check types if needed, but here we just try to send
            await transporter.sendMail({
                from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
                to: email, 
                cc: ccEmail, // Send to establishment admin if applicable
                bcc: monitorEmail, 
                subject: `Code de signature OTP - Convention PFMP`,
                text: message
            });

        }


        // Audit Log (Non-blocking)
        try {
            step = 'Audit Log';
            console.log(`[Audit] OTP_SENT for ${email} (Convention: ${conventionId})`);
            // TODO: Migrate audit logs to Postgres
        } catch (e) {
            console.error("Audit log error:", e);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error(`Error sending OTP at step ${step}:`, error);
        return NextResponse.json({ error: `Erreur (${step}): ${error.message || error}` }, { status: 500 });
    }
}
