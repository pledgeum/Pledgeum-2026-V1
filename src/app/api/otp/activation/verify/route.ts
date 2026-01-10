import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { checkRateLimit } from '@/lib/server-security';
import { z } from 'zod';

const verifySchema = z.object({
    email: z.string().email(),
    code: z.string().length(4),
    purpose: z.literal("activation")
});

export async function POST(request: Request) {
    try {
        // NO Auth Check - Public

        // 1. Rate Limiting
        const isAllowed = await checkRateLimit(request, 'otp-activation-verify');
        if (!isAllowed) {
            return NextResponse.json({ error: "Trop de tentatives. Réessayez dans 15 minutes." }, { status: 429 });
        }

        const body = await request.json();
        const validation = verifySchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: "Format invalide" }, { status: 400 });
        }

        const { email, code } = validation.data;

        // Query Firestore
        const otpsRef = adminDb.collection("otps");
        const querySnapshot = await otpsRef
            .where("email", "==", email)
            .where("code", "==", code)
            .where("purpose", "==", "activation")
            .get();

        if (querySnapshot.empty) {
            return NextResponse.json({ success: false, error: "Code invalide" }, { status: 400 });
        }

        // Check expiration
        let valid = false;
        const now = new Date();
        const batch = adminDb.batch();

        querySnapshot.forEach((docSnapshot) => {
            const data = docSnapshot.data();
            const expiresAt = new Date(data.expiresAt);
            if (expiresAt > now) {
                valid = true;
            }
            // Cleanup
            batch.delete(docSnapshot.ref);
        });

        await batch.commit();

        if (valid) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ success: false, error: "Code expiré" }, { status: 400 });
        }

    } catch (error: any) {
        console.error("Error verifying Activation OTP:", error);
        return NextResponse.json({ error: "Erreur lors de la vérification" }, { status: 500 });
    }
}
