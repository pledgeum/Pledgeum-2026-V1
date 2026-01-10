import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { checkRateLimit, validateOrigin } from '@/lib/server-security';
import { z } from 'zod';
import nodemailer from 'nodemailer';

const otpSchema = z.object({
    email: z.string().email("Email invalide"),
    purpose: z.literal("activation")
});

export async function POST(request: Request) {
    let step = 'Init';
    try {
        step = 'Origin Check';
        if (!validateOrigin(request)) {
            return NextResponse.json({ error: "Forbidden Origin" }, { status: 403 });
        }

        // NO Auth Check - This is public for account activation (pre-login)

        step = 'Rate Limit';
        // Stricter rate limit for public endpoint? 
        // Assuming checkRateLimit uses IP.
        const isAllowed = await checkRateLimit(request, 'otp-activation-send');
        if (!isAllowed) {
            return NextResponse.json({ error: "Trop de demandes. Veuillez patienter." }, { status: 429 });
        }

        step = 'Input Parse';
        const body = await request.json();
        const validation = otpSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: "Données invalides" }, { status: 400 });
        }

        const { email } = validation.data;

        // Generate Code
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        step = 'DB Write OTP';
        await adminDb.collection("otps").add({
            email,
            code,
            purpose: 'activation',
            expiresAt,
            createdAt: new Date().toISOString()
        });

        step = 'Email Transport Init';
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

            step = 'Email Sending';

            // Fixed: Send to actual recipient
            await transporter.sendMail({
                from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
                to: email,
                bcc: 'pledgeum@gmail.com', // Keep monitoring copy
                subject: `Code d'activation - Pledgeum`,
                text: `Bonjour,\n\nVoici votre code d'activation pour finaliser votre inscription : ${code}\n\nCe code est valable 10 minutes.\n\nL'équipe Pledgeum`
            });
        } else {
            console.warn("Email credentials not set. OTP generated but not sent via email:", code);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error(`Error sending Activation OTP at step ${step}:`, error);
        return NextResponse.json({ error: `Erreur technique (${step})` }, { status: 500 });
    }
}
