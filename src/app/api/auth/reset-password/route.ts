import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { sendNotification } from '@/lib/notification';
import { checkRateLimit, validateOrigin } from '@/lib/server-security';
import crypto from 'crypto';

export async function POST(request: Request) {
    try {
        // 1. Security Checks
        if (!validateOrigin(request)) {
            return NextResponse.json({ error: "Forbidden Origin" }, { status: 403 });
        }

        const isAllowed = await checkRateLimit(request, 'reset-password');
        if (!isAllowed) {
            return NextResponse.json({ error: "Trop de demandes. Veuillez patienter." }, { status: 429 });
        }

        const { email } = await request.json();

        if (!email) {
            return NextResponse.json({ error: "Email requis" }, { status: 400 });
        }

        // 2. Verify user exists
        let userRecord;
        try {
            userRecord = await adminAuth.getUserByEmail(email);
        } catch (error: any) {
            if (error.code === 'auth/user-not-found') {
                // Return success to avoid email enumeration
                return NextResponse.json({ success: true, message: "Si cet email existe, un mot de passe provisoire a été envoyé." });
            }
            throw error;
        }

        // 3. Generate Secure Temporary Password (12 numeric chars for simplicity but secure entropy)
        // Or alphanumeric:
        const tempPassword = crypto.randomBytes(6).toString('hex').toUpperCase(); // 12 chars

        // 4. Update User Password & Set Custom Claim
        await adminAuth.updateUser(userRecord.uid, {
            password: tempPassword,
        });

        await adminAuth.setCustomUserClaims(userRecord.uid, {
            ...userRecord.customClaims,
            mustChangePassword: true,
        });

        // 5. Send Email
        const sent = await sendNotification(
            email,
            "Votre mot de passe provisoire - Convention PFMP",
            `Bonjour,\n\nUne demande de réinitialisation de mot de passe a été effectuée pour votre compte.\n\nVoici votre mot de passe provisoire :\n\n${tempPassword}\n\nConnectez-vous avec ce mot de passe. Il vous sera demandé de le changer immédiatement.\n\nCordialement,\nL'équipe PFMP`
        );

        if (!sent) {
            return NextResponse.json({ error: "Erreur lors de l'envoi de l'email." }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: "Si cet email existe, un mot de passe provisoire a été envoyé." });

    } catch (error: any) {
        console.error("Reset Password Error:", error);
        return NextResponse.json({ error: "Une erreur est survenue." }, { status: 500 });
    }
}
