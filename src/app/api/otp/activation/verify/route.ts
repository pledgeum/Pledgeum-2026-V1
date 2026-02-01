import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyOTP } from '@/lib/otp';

const verifySchema = z.object({
    email: z.string().email("Email invalide"),
    code: z.string().length(4, "Code invalide"), // Frontend sends 4 digits
    purpose: z.string().optional()
});

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const validation = verifySchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: "Données invalides" }, { status: 400 });
        }

        const { email, code } = validation.data;

        const result = await verifyOTP(email, code);

        if (result.valid) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ error: "Code invalide ou expiré" }, { status: 400 });
        }

    } catch (error) {
        console.error("OTP Verify Error:", error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}
