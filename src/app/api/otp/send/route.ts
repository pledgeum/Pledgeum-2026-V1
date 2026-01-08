import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { headers } from 'next/headers';
import { checkRateLimit, validateOrigin, verifyUserSession } from '@/lib/server-security';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import admin from 'firebase-admin';

// Schema Validation
const otpSchema = z.object({
    email: z.string().email("Email invalide"),
    conventionId: z.string().min(1, "ID Convention requis")
});

export async function POST(request: Request) {
    let step = 'Init';
    try {
        step = 'Origin Check';
        if (!validateOrigin(request)) {
            return NextResponse.json({ error: "Forbidden Origin" }, { status: 403 });
        }

        step = 'Auth Check';
        const user = await verifyUserSession(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        step = 'Rate Limit';
        const isAllowed = await checkRateLimit(request, 'otp-send');
        if (!isAllowed) {
            return NextResponse.json({ error: "Trop de demandes. Veuillez patienter." }, { status: 429 });
        }

        step = 'Input Parse';
        const body = await request.json();
        const validation = otpSchema.safeParse(body);

        if (!validation.success) {
            const issues = validation.error.errors || (validation.error as any).issues || [];
            return NextResponse.json({ error: issues[0]?.message || "Données invalides" }, { status: 400 });
        }

        const { email, conventionId } = validation.data;
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        step = 'DB Write OTP';
        await adminDb.collection("otps").add({
            email,
            conventionId,
            code,
            expiresAt,
            createdAt: new Date().toISOString()
        });

        step = 'DB Write Notification';
        await adminDb.collection("notifications").add({
            recipientEmail: email,
            title: 'Code de signature OTP - Convention PFMP',
            message: `Votre code de signature est : ${code}`,
            date: new Date().toISOString(),
            read: false,
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

            const message = `Bonjour, \n\nVoici votre code de sécurité pour signer la convention: ${code} \n\nCe code est valable 10 minutes.\n\nCordialement.`;
            const testEmail = 'pledgeum@gmail.com';

            step = 'Email Sending';
            // Explicitly cast to any or check types if needed, but here we just try to send
            await transporter.sendMail({
                from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
                to: testEmail,
                subject: `[TEST] Code de signature OTP - Convention PFMP`,
                text: `[Intended for: ${email}]\n\n${message}`
            });
        }

        // Audit Log (Non-blocking)
        try {
            step = 'Audit Log';
            const headersList = await headers();
            const ip = headersList.get('x-forwarded-for') || 'unknown';

            await adminDb.collection("conventions").doc(conventionId).update({
                auditLogs: admin.firestore.FieldValue.arrayUnion({
                    date: new Date().toISOString(),
                    action: 'OTP_SENT',
                    actorEmail: email,
                    ip: ip,
                    details: 'Code envoyé par email'
                })
            });
        } catch (e) {
            console.error("Audit log error:", e);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error(`Error sending OTP at step ${step}:`, error);
        return NextResponse.json({ error: `Erreur (${step}): ${error.message || error}` }, { status: 500 });
    }
}
