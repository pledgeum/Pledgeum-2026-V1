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

/**
 * Validates if the current session user has access to a specific convention.
 * @param session Current Auth Session
 * @param convention Convention object from DB
 * @returns boolean
 */
export function validateAccess(session: any, convention: any): boolean {
    if (!session || !session.user) return false;

    const user = session.user;
    const userRole = user.role;
    const userEmail = user.email?.toLowerCase().trim();
    const userId = user.id || user.uid;

    if (!userEmail) return false;

    // 1. Admins have global access
    if (userRole === 'admin' || userRole === 'SUPER_ADMIN') {
        return true;
    }

    // 2. Establishment-level roles (access by UAI)
    const establishmentLevelRoles = ['school_head', 'ddfpt', 'at_ddfpt', 'business_manager', 'assistant_manager', 'stewardship_secretary', 'ESTABLISHMENT_ADMIN'];
    if (establishmentLevelRoles.includes(userRole)) {
        // user.establishment_uai or user.uai should match convention.establishment_uai
        const userUai = user.establishment_uai || user.uai;
        const convUai = convention.establishment_uai || convention.establishmentUai;
        return !!userUai && userUai === convUai;
    }

    // 3. Convention-specific roles (access by email/ID)
    const metadata = convention.metadata || {};
    
    // Student
    if (userRole === 'student') {
        const studentId = convention.student_uid || convention.studentId;
        return (studentId === userId) || (studentId === userEmail);
    }

    // Teacher / Tracking Teacher
    if (userRole === 'teacher' || userRole === 'teacher_tracker') {
        const teacherEmail = (convention.teacher_email || convention.teacherEmail || metadata.prof_email)?.toLowerCase().trim();
        const trackingEmail = (convention.tracking_teacher_email || convention.prof_suivi_email || metadata.prof_suivi_email)?.toLowerCase().trim();
        return (userEmail === teacherEmail) || (userEmail === trackingEmail);
    }

    // Parent / Legal Rep
    if (userRole === 'parent' || userRole === 'rep_legal') {
        const parentEmail = (metadata.rep_legal_email || metadata.parent_email)?.toLowerCase().trim();
        return userEmail === parentEmail;
    }

    // Company / Tutor
    if (userRole === 'tutor' || userRole === 'company_head' || userRole === 'company_head_tutor') {
        const tutorEmail = (convention.tutor_email || convention.tutorEmail || metadata.tuteur_email)?.toLowerCase().trim();
        const repEmail = (convention.ent_rep_email || metadata.ent_rep_email)?.toLowerCase().trim();
        return (userEmail === tutorEmail) || (userEmail === repEmail);
    }

    return false;
}
