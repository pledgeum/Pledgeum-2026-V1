import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { headers } from 'next/headers';
import { checkRateLimit, verifyUserSession } from '@/lib/server-security';
import { z } from 'zod';
import admin from 'firebase-admin';

const verifySchema = z.object({
    email: z.string().email(),
    code: z.string().length(4)
});

export async function POST(request: Request) {
    try {
        const user = await verifyUserSession(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 1. Rate Limiting (Prevent Brute Force)
        const isAllowed = await checkRateLimit(request, 'otp-verify');
        if (!isAllowed) {
            return NextResponse.json({ error: "Trop de tentatives. Réessayez dans 15 minutes." }, { status: 429 });
        }

        const body = await request.json();
        const validation = verifySchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: "Format invalide" }, { status: 400 });
        }

        const { email, code } = validation.data;

        // Admin SDK Query
        const otpsRef = adminDb.collection("otps");
        const querySnapshot = await otpsRef
            .where("email", "==", email)
            .where("code", "==", code)
            .get();

        if (querySnapshot.empty) {
            return NextResponse.json({ success: false, error: "Code invalide" }, { status: 400 });
        }

        // Check expiration and clean up
        let valid = false;
        const now = new Date();

        // There might be multiple OTPs if spammed, check all matches
        const batch = adminDb.batch();

        let conventionId = '';

        querySnapshot.forEach((docSnapshot) => {
            const data = docSnapshot.data();
            const expiresAt = new Date(data.expiresAt);
            if (expiresAt > now) {
                valid = true;
                conventionId = data.conventionId;
            }
            // Delete used/expired OTPs to prevent reuse
            batch.delete(docSnapshot.ref);
        });

        await batch.commit();

        if (valid && conventionId) {
            // Audit Log
            try {
                const headersList = await headers();
                const ip = headersList.get('x-forwarded-for') || 'unknown';
                const auditLog = {
                    date: new Date().toISOString(),
                    action: 'OTP_VALIDATED',
                    actorEmail: email,
                    ip: ip,
                    details: 'Code OTP validé avec succès'
                };

                await adminDb.collection("conventions").doc(conventionId).update({
                    auditLogs: admin.firestore.FieldValue.arrayUnion(auditLog)
                });

                return NextResponse.json({ success: true, auditLog });
            } catch (e) {
                console.error("Audit log error:", e);
                // Non-blocking
            }

            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ success: false, error: "Code expiré" }, { status: 400 });
        }

    } catch (error: any) {
        console.error("Error verifying OTP:", error);
        return NextResponse.json({ error: "Erreur lors de la vérification" }, { status: 500 });
    }
}
