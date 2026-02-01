import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { checkRateLimit, verifyUserSession } from '@/lib/server-security';
import { z } from 'zod';
import { verifyOTP } from '@/lib/otp';

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

        // Verify with Postgres Helper
        const verification = await verifyOTP(email, code);

        if (!verification.valid) {
            return NextResponse.json({ success: false, error: "Code invalide ou expiré" }, { status: 400 });
        }

        const conventionId = verification.conventionId;
        // Proceed with audit logging using conventionId

        if (conventionId) {
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

                console.log(`[Audit] OTP_VALIDATED for ${email} (Convention: ${conventionId})`);
                // TODO: Migrate audit logs to Postgres

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
