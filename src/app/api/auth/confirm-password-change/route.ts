import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { verifyUserSession } from '@/lib/server-security';

export async function POST(request: Request) {
    try {
        // 1. Verify Session
        const decodedToken = await verifyUserSession(request);
        if (!decodedToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const uid = decodedToken.uid;

        // 2. Clear 'mustChangePassword' claim
        // We preserve other claims if any, but specifically remove this one.
        // Actually, setCustomUserClaims REPLACES claims, so we need to be careful.
        // But verifying session gave us the token, not full user record with all claims.
        // Better to get fresh user record.
        const user = await adminAuth.getUser(uid);
        const currentClaims = user.customClaims || {};

        const newClaims = { ...currentClaims };
        delete newClaims.mustChangePassword;

        await adminAuth.setCustomUserClaims(uid, newClaims);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Confirm Password Change Error:", error);
        return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
    }
}
