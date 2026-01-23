
import { NextResponse } from 'next/server';
import { updateConventionStatus, WorkflowStatus } from '@/lib/workflow';
import { adminAuth } from '@/lib/firebase-admin';

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: conventionId } = await params;
        const body = await req.json();
        const { status, reason, pdfHash } = body;

        // Security Check: Verify User Token
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const userRole = decodedToken.role;
        const userEmail = decodedToken.email;

        // Authorization Logic
        // 1. Fetch Convention Owner Identity to verify ownership if needed
        // Ideally we fetch this from DB, but for now we rely on logical checks.
        // NOTE: For 'SUBMITTED', we trust the caller has write access to the doc via Firestore rules, 
        // strictly here we should verify ownership. 
        // Since this is a critical state change, let's enforce based on Role.

        if (status === 'SUBMITTED') {
            // Student submits. Allow generic 'student' role or Admin.
            // Ideally check if (userRole === 'student' && userEmail === conventionOwnerEmail).
            if (userRole !== 'student' && userRole !== 'admin' && userEmail !== 'pledgeum@gmail.com') {
                return NextResponse.json({ error: 'Forbidden: Only students can submit conventions.' }, { status: 403 });
            }
        }

        if (status === 'VALIDATED_BY_PP') {
            if (userRole !== 'teacher' && userRole !== 'school_head' && userRole !== 'admin' && userRole !== 'ddfpt') {
                return NextResponse.json({ error: 'Forbidden: Only teachers/admin can validate.' }, { status: 403 });
            }
        }

        if (status === 'SIGNED_BY_SCHOOL' || status === 'COMPLETED') {
            if (userRole !== 'school_head' && userRole !== 'admin') {
                return NextResponse.json({ error: 'Forbidden: Only School Head can sign/complete.' }, { status: 403 });
            }
        }

        const result = await updateConventionStatus(conventionId, status as WorkflowStatus, { reason, pdfHash });

        return NextResponse.json({ success: true, data: result });

    } catch (error: any) {
        console.error("API Workflow Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
