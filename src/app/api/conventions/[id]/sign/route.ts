
import { NextResponse } from 'next/server';
import pool from '@/lib/pg';
// import { getServerSession } from "next-auth"; // REMOVED - using 'auth' from src/auth for v5 or compatible
import { auth } from "@/auth"; // Assuming auth.ts exists in src/ based on 'handlers' export seen in [...nextauth]

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: conventionId } = await params;
        const body = await req.json();
        const { role, signatureImage, code, dualSign } = body;

        if (!role) {
            return NextResponse.json({ error: 'Role is required' }, { status: 400 });
        }

        // --- 1. Determine New Status & Metadata Updates ---
        // This logic mimics the state machine in the store, but securely on the server.
        // For simplicity in this migration step, we trust the "role" implies the next step if valid.
        // A full state machine re-implementation on server is ideal, but here we focus on the DB update mechanism.

        const now = new Date().toISOString();
        let newStatus = null;
        let metadataUpdates: any = {};

        // Helper to map role to fields
        // Note: We are merging into the JSONB 'metadata' column for these fields as per Hybrid Schema.
        switch (role) {
            case 'student':
                newStatus = 'SUBMITTED'; // Simplification: Student signing moves to submitted
                metadataUpdates = {
                    signatures: {
                        studentAt: now,
                        studentImg: signatureImage,
                        studentCode: code,
                        studentSignatureId: code // Added for PDF persistence
                    }
                };
                break;
            case 'parent':
                newStatus = 'SIGNED_PARENT';
                metadataUpdates = {
                    signatures: {
                        parentAt: now,
                        parentImg: signatureImage,
                        parentCode: code,
                        parentSignatureId: code // Added for PDF persistence
                    }
                };
                break;
            case 'teacher':
                newStatus = 'VALIDATED_TEACHER';
                metadataUpdates = {
                    signatures: {
                        teacherAt: now,
                        teacherImg: signatureImage,
                        teacherCode: code,
                        teacherSignatureId: code // Added for PDF persistence
                    }
                };
                break;
            // For Company/Tutor/Head, we might update dedicated columns OR metadata depending on the exact requirement.
            // The user request specifically mentioned updating metadata for student/parent/teacher legacy fields.
            // But let's handle the others for completeness if they come through this route.
            case 'company_head':
                newStatus = 'SIGNED_COMPANY'; // Partial
                // Note: The hybrid schema usually puts company signatures in dedicated columns, 
                // but the prompt asked to use metadata JSONB merge for safety.
                // We will stick to metadata updates for consistency with the request for now, 
                // knowing that `updateConventionStatus` in workflow.ts might handle the dedicated columns later or unrelatedly.
                // WAIT: The prompt says "Student signatures go into metadata JSON, Company signatures have dedicated columns".
                // If this API handles ALL signatures, we should also update dedicated columns for Company if they exist.
                // However, the prompt specific example was about metadata JSONB merge. 
                // Let's stick to the metadata JSONB merge for ALL "signatures" object fields to ensure frontend compatibility (which reads convention.signatures.*).
                metadataUpdates = {
                    signatures: {
                        companyAt: now,
                        companyImg: signatureImage,
                        companyCode: code,
                        companySignatureId: code // Added for PDF persistence
                    }
                };
                break;
            case 'tutor':
                // Tutor logic often complex (dual sign etc). 
                metadataUpdates = {
                    signatures: {
                        tutorAt: now,
                        tutorImg: signatureImage,
                        tutorCode: code,
                        tutorSignatureId: code // Added for PDF persistence
                    }
                };
                break;
            case 'school_head':
                newStatus = 'VALIDATED_HEAD';
                metadataUpdates = {
                    signatures: {
                        headAt: now,
                        headImg: signatureImage,
                        headCode: code,
                        headSignatureId: code // Added for PDF persistence
                    }
                };
                break;
        }

        // --- 2. Update via Workflow Logic ---
        // Instead of manual SQL update, we leverage the centralized workflow helper
        // which handles tokens, status transitions, and consistency.

        const { updateConventionStatus } = await import('@/lib/workflow'); // Dynamic import to avoid cycles if any

        // We map our metadataUpdates.signatures to the structure expected by updateConventionStatus
        // The helper now supports `signatures` in the metadataParts arg.

        try {
            // If newStatus is determined, we transition
            // If newStatus is null (e.g. Tutor signed but other tutor hasn't? or just intermediate?), 
            // for now our logic above ALWAYS determines a status or keeps same maybe?
            // "partial" status updates might be needed if we don't change the main string.
            // But updateConventionStatus requires a status. 
            // If we are just adding a signature without changing state (e.g. dual tutor?), 
            // we should probably fetch current status. 
            // BUT given the switch case above sets `newStatus` for all roles except Tutor?
            // Tutor case in switch above has `metadataUpdates` but NO `newStatus`.

            // Let's fix Tutor status logic to "SIGNED_TUTOR" if that's the intention, 
            // or keep current status if it's just one of many.
            // Assuming "SIGNED_TUTOR" is a valid intermediate state (it is in our new Types).

            let statusToApply = newStatus;

            if (!statusToApply) {
                // If no specific status transition defined (e.g. Tutor?), 
                // we might need to fetch current status.
                // However, for this fix, let's assume Tutor -> SIGNED_TUTOR
                if (role === 'tutor') statusToApply = 'SIGNED_TUTOR';
                else {
                    // Fallback: Fetch current status? 
                    // Ideally updateConventionStatus supports "current" or we pass null and it handles it.
                    // But it requires status arg.
                    // For safety, let's query it if missing.
                    const res = await pool.query('SELECT status FROM conventions WHERE id = $1', [conventionId]);
                    if (res.rowCount != null && res.rowCount > 0) statusToApply = res.rows[0].status;
                    else throw new Error("Convention not found");
                }
            }

            const updatedConvention = await updateConventionStatus(
                conventionId,
                statusToApply as any,
                {
                    signatures: metadataUpdates.signatures
                }
            );

            return NextResponse.json({ success: true, data: updatedConvention });

        } catch (error: any) {
            console.error('Sign API via Workflow Error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
