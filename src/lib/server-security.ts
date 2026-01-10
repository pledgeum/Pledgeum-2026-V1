import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import admin from 'firebase-admin';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function verifyUserSession(request: Request) {
    const authHeader = request.headers.get('Authorization');
    // console.log("[AuthDebug] Header:", authHeader ? "Present" : "Missing"); // Do not log full token for security

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.error("[AuthDebug] Missing or invalid Authorization header");
        return null;
    }
    const token = authHeader.split('Bearer ')[1];
    try {
        const decodedToken = await adminAuth.verifyIdToken(token);
        // console.log("[AuthDebug] Token verified for UID:", decodedToken.uid);
        return decodedToken;
    } catch (error: any) {
        console.error("[AuthDebug] Token verification failed:", error.code, error.message);
        return null;
    }
}

// Rate Limit Configuration
const RATE_LIMITS = {
    'send-email': { max: 10, window: 60 * 1000 }, // 10 emails per minute per IP
    'reset-password': { max: 5, window: 60 * 1000 }, // 5 resets per minute
    'otp-send': { max: 5, window: 60 * 1000 }, // 5 OTPs per minute per IP
    'otp-verify': { max: 5, window: 15 * 60 * 1000 }, // 5 attempts per 15 mins per IP
    'otp-activation-send': { max: 5, window: 60 * 1000 }, // 5 Activation OTPs per minute per IP
    'otp-activation-verify': { max: 5, window: 15 * 60 * 1000 } // 5 Activation confirm attempts per 15 mins
};

export async function checkRateLimit(request: Request, type: keyof typeof RATE_LIMITS) {
    try {
        const headersList = await headers();
        const ip = headersList.get('x-forwarded-for') || 'unknown_ip';
        const limit = RATE_LIMITS[type];

        // Simple key based on IP and Action
        const key = `ratelimit_${type}_${ip.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const ref = adminDb.collection('rate_limits').doc(key);
        const snap = await ref.get();
        const now = Date.now();

        if (snap.exists) {
            const data = snap.data();
            if (data && now - data.windowStart < limit.window) {
                if (data.count >= limit.max) {
                    return false; // Limit exceeded
                }
                // Increment
                await ref.update({ count: admin.firestore.FieldValue.increment(1) });
            } else {
                // Reset window
                await ref.set({ count: 1, windowStart: now });
            }
        } else {
            // New record
            await ref.set({ count: 1, windowStart: now });
        }
        return true;
    } catch (e) {
        console.error("Rate limit error (fail open):", e);
        return true; // Fail open to avoid blocking legit users on DB error
    }
}

export function validateOrigin(request: Request) {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host'); // e.g., localhost:3000

    // Allow requests with no origin (e.g. server-side calls) or matching origin
    if (!origin) return true;

    // Check if origin contains the host
    // Strict production check would be: origin === process.env.NEXT_PUBLIC_APP_URL
    return origin.includes(host || '') || origin.includes('localhost') || origin.includes('vercel.app');
}
