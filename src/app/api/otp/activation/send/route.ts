import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createOTP, ensureOtpTable } from '@/lib/otp';
import { sendEmail } from '@/lib/email';

const otpSchema = z.object({
    email: z.string().email("Email invalide"),
    // purpose is optional but can be checked if needed
    purpose: z.string().optional()
});

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const validation = otpSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: "Email invalide" }, { status: 400 });
        }

        const { email } = validation.data;
        const code = Math.floor(1000 + Math.random() * 9000).toString(); // 4 digits as per frontend placeholder
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

        await ensureOtpTable();
        await createOTP(email, 'activation', code, expiresAt);

        const emailSent = await sendEmail({
            to: email,
            subject: 'Code de vérification - Activation de compte',
            text: `Bonjour,\n\nVoici votre code de vérification pour activer votre compte : ${code}\n\nCe code est valable 10 minutes.\n\nCordialement,\nL'équipe.`
        });

        if (!emailSent) {
            console.error("Failed to send activation email to", email);
            return NextResponse.json({ error: "Erreur lors de l'envoi de l'email" }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Activation OTP Error:", error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}
