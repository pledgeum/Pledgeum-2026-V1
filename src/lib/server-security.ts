import { auth } from '@/auth';

export async function verifyUserSession(request: Request) {
    const session = await auth();
    if (session?.user) {
        return session.user;
    }
    return null;
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
    // Rate limits disabled during migration to Postgres
    return true;
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
