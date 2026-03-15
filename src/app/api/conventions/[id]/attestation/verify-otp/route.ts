import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { verifyOTP } from '@/lib/otp';
import { headers } from 'next/headers';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { email, code } = body;

        if (!email || !code) {
            return NextResponse.json({ error: "Email et code requis" }, { status: 400 });
        }

        // Verify with Postgres Helper
        const verification = await verifyOTP(email, code);

        if (!verification.valid) {
            return NextResponse.json({ success: false, error: "Code invalide ou expiré" }, { status: 400 });
        }

        const headersList = await headers();
        const ip = headersList.get('x-forwarded-for') || 'unknown';
        const auditLog = {
            date: new Date().toISOString(),
            action: 'OTP_VALIDATED',
            actorEmail: email,
            ip: ip,
            details: 'Code OTP validé avec succès pour l\'attestation'
        };

        console.log(`[Audit] OTP_VALIDATED for attestation ${email}`);

        return NextResponse.json({ success: true, auditLog });

    } catch (error: any) {
        console.error("Error verifying Attestation OTP:", error);
        return NextResponse.json({ error: "Erreur lors de la vérification" }, { status: 500 });
    }
}
