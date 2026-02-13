
import { NextResponse } from 'next/server';
import pool from '@/lib/pg';
import { auth } from '@/auth';
import crypto from 'crypto';

export async function GET(request: Request) {
    const session = await auth();
    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const uai = searchParams.get('uai');
    const studentId = searchParams.get('studentId');
    const limit = parseInt(searchParams.get('limit') || '100');

    if (!pool) {
        return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
    }

    const client = await pool.connect();
    try {
        const userEstablishmentUai = (session.user as any).establishment_uai;
        const userRole = (session.user as any).role;

        if (userRole !== 'SUPER_ADMIN' && userRole !== 'parent' && !userEstablishmentUai) {
            console.error('[API_CONVENTIONS] Security Alert: User has no establishment_uai linked. Returning empty.');
            return NextResponse.json({ success: true, conventions: [], count: 0 });
        }

        // SYSTEMIC FIX: Fetch Live Teacher Data via JOIN (Snapshots are ignored for Teacher Email)
        const queryStr = `
            SELECT 
                c.id,
                c.status,
                c.metadata,
                c.duration_hours as "durationHours",
                TO_CHAR(c.date_start, 'YYYY-MM-DD') as "dateStart",
                TO_CHAR(c.date_end, 'YYYY-MM-DD') as "dateEnd",
                c.validated_at as "validatedAt",
                c.signature_company_at as "signatureCompanyAt",
                c.signature_school_at as "signatureSchoolAt",
                c.tutor_email as "tutorEmail",
                c.tutor_name as "tutorName",
                c.company_siret as "companySiret",
                c.student_uid as "studentId",
                c.establishment_uai as "establishmentUai",
                c.establishment_uai as "schoolId",
                c.class_id as "classId",
                c.pdf_hash as "pdfHash",
                c.rejection_reason as "rejectionReason",
                c.token_company as "tokenCompany",
                c.token_school as "tokenSchool",
                c.created_at as "createdAt",
                c.updated_at as "updatedAt",
                -- LIVE TEACHER DATA
                u.email as "teacherEmail",
                u.first_name as "teacherFirstName",
                u.last_name as "teacherLastName"
            FROM conventions c
            LEFT JOIN classes cls ON c.class_id = cls.id
            LEFT JOIN users u ON cls.main_teacher_id = u.uid
            WHERE 1=1
        `;

        let query = queryStr;
        const params: any[] = [];
        let paramIndex = 1;

        if (userRole === 'parent') {
            // Parent: Fetch by Legal Representative Email
            // Case insensitive comparison for robustness
            query += ` AND LOWER(c.metadata->>'rep_legal_email') = LOWER($${paramIndex})`;
            params.push(session.user.email);
            paramIndex++;
        } else if (userRole !== 'SUPER_ADMIN') {
            // Default (School Admin, Teacher, Student?): Fetch by Establishment UAI
            query += ` AND c.establishment_uai = $${paramIndex}`;
            params.push(userEstablishmentUai);
            paramIndex++;
        } else if (uai) {
            // Super Admin with explicit UAI filter
            query += ` AND c.establishment_uai = $${paramIndex}`;
            params.push(uai);
            paramIndex++;
        }

        if (studentId) {
            query += ` AND c.student_uid = $${paramIndex}`;
            params.push(studentId);
            paramIndex++;
        }

        query += ` ORDER BY c.updated_at DESC LIMIT $${paramIndex}`;
        params.push(limit);

        const res = await client.query(query, params);

        const conventions = res.rows.map(c => ({
            ...c,
            signatures: c.metadata?.signatures || {}, // Flatten signatures for frontend compatibility
        }));

        return NextResponse.json({
            success: true,
            conventions: conventions,
            count: res.rowCount
        });

    } catch (error: any) {
        console.error('[API_CONVENTIONS] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    } finally {
        client.release();
    }
}

// ... (imports)

// Helper to send emails safely without blocking the response
const safeSendEmail = async (params: any) => {
    try {
        const { sendEmail } = await import('@/lib/email');
        const result = await sendEmail(params);
        if (!result.success) {
            console.error('[API_CONVENTIONS] Email Error:', result.error);
            return { type: 'EMAIL_FAILED', detail: result.error };
        }
        return null;
    } catch (e: any) {
        console.error('[API_CONVENTIONS] Email Exception:', e);
        return { type: 'EMAIL_EXCEPTION', detail: e.message };
    }
};

export async function POST(req: Request) {
    let emailWarning: { type: string, detail: string } | null = null;
    try {
        const session = await auth();
        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { studentId, ...data } = body;

        // Basic validation
        if (!data.ent_nom || !data.dateStart) { // Adjust validation as needed
            // Just a soft check, Schema validation happens on DB constraints or Zod if imported
        }

        // Check for signature in payload to determine initial status
        let initialStatus = 'DRAFT';
        if (data.signatures && data.signatures.studentImg) {
            initialStatus = 'SUBMITTED';
            const now = new Date().toISOString();

            // Construct nested student signature object
            // We move 'studentImg' into 'student.img' and add metadata
            const studentSig = {
                signedAt: now,
                img: data.signatures.studentImg,
                code: 'CANVAS', // Default for initial creation via canvas
                hash: crypto.createHash('sha256').update(`student:${now}:CANVAS`).digest('hex'),
                ip: req.headers.get('x-forwarded-for') || 'unknown',
            };

            // Replace flat logic with nested logic
            data.signatures.student = studentSig;

            // Remove legacy flat keys if they exist in payload to keep DB clean
            delete data.signatures.studentImg;
            delete data.signatures.studentAt;
        }

        // Map frontend camelCase to SnakeCase for DB
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Generate IDs
            const conventionsId = 'conv_' + Math.random().toString(36).substr(2, 9);

            // Insert
            const query = `
                INSERT INTO conventions (
                    id, 
                    student_uid, 
                    status, 
                    created_at, 
                    updated_at,
                    metadata,
                    date_start,
                    date_end
                ) VALUES ($1, $2, $3, NOW(), NOW(), $4, $5, $6)
                RETURNING *
            `;
            // We store the specific fields in metadata for now if we don't map them all to columns yet.
            // Critical ones: establishment_uai (from session)
            const uai = (session.user as any).establishment_uai;

            const result = await client.query(query, [
                conventionsId,
                studentId || (session.user as any).id,
                initialStatus,
                JSON.stringify(data),
                data.dateStart || data.stage_date_debut,
                data.dateEnd || data.stage_date_fin
            ]);

            // Update establishment_uai if available
            if (uai) {
                await client.query('UPDATE conventions SET establishment_uai = $1 WHERE id = $2', [uai, conventionsId]);
            }

            await client.query('COMMIT');

            // --- EMAIL & NOTIFICATION LOGIC (MOVED FROM LEGACY ROUTE) ---
            if (initialStatus === 'SUBMITTED' && data.signatures && (data.signatures.student || data.signatures.studentImg)) {
                // Run in background / parallel to avoid blocking the fast response, 
                // OR await if we want to return warnings.
                // Given the user wants to avoid "Ghost" issues, let's await but catch errors so main flow succeeds.

                // 1. Notify Student
                if (data.eleve_email) {
                    await safeSendEmail({
                        to: data.eleve_email,
                        subject: `Confirmation de signature`,
                        text: `Bonjour ${data.eleve_prenom || 'Elève'},\n\n` +
                            `Vous avez signé votre convention.\n` +
                            `Nous avons envoyé une demande de validation à votre représentant légal (${data.rep_legal_email}).\n\n` +
                            `Cordialement,\nL'équipe Pledgeum`
                    });
                }

                // 2. Notify / Onboard Parent
                if (data.est_mineur && data.rep_legal_email) {
                    const parentEmail = data.rep_legal_email.toLowerCase().trim();

                    // Check if parent account exists
                    const userCheck = await pool.query('SELECT uid FROM users WHERE email = $1', [parentEmail]);
                    const exists = userCheck.rowCount !== null && userCheck.rowCount > 0;

                    if (!exists) {
                        try {
                            const tempPassword = Math.random().toString(36).slice(-8) + "Aa1!";
                            const bcrypt = await import('bcryptjs');
                            const hashedPassword = await bcrypt.hash(tempPassword, 10);

                            const parentName = data.rep_legal_nom || data.rep_legal_prenom || "Parent";
                            const firstName = data.rep_legal_prenom || parentName.split(' ')[0];
                            const lastName = data.rep_legal_nom || parentName.split(' ').slice(1).join(' ');

                            console.log('[PARENT_CREATE] Attempting to create user:', parentEmail);
                            const newParentUid = crypto.randomUUID();

                            const result = await pool.query(
                                `INSERT INTO users (
                                    uid, email, role, password_hash, must_change_password, 
                                    first_name, last_name, phone, created_at, updated_at
                                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
                                RETURNING uid`,
                                [newParentUid, parentEmail, 'parent', hashedPassword, true, firstName, lastName, data.rep_legal_tel || ""]
                            );

                            if (result.rowCount && result.rowCount > 0) {
                                console.log('[PARENT_CREATE] Success, UID:', result.rows[0].uid);
                            } else {
                                throw new Error('INSERT failed, no rows returned');
                            }

                            // Welcome Email
                            const wRes = await safeSendEmail({
                                to: parentEmail,
                                subject: "Bienvenue sur Pledgeum - Votre compte Parent a été créé",
                                text: `Bonjour ${firstName || 'Parent'},\n\n` +
                                    `Suite à la signature de la convention de stage de votre enfant ${data.eleve_prenom} ${data.eleve_nom}, un compte a été automatiquement créé pour vous permettre de signer le document.\n\n` +
                                    `Voici vos identifiants de connexion :\n` +
                                    `Identifiant : ${parentEmail}\n` +
                                    `Mot de passe temporaire : ${tempPassword}\n\n` +
                                    `Veuillez vous connecter dès maintenant pour changer votre mot de passe et finaliser la signature : ${process.env.NEXT_PUBLIC_APP_URL || 'https://www.pledgeum.fr'}/login\n\n` +
                                    `Cordialement,\nL'équipe Pledgeum`
                            });
                            if (wRes) emailWarning = wRes;

                        } catch (e: any) {
                            console.error('[API_CONVENTIONS] Failed to create parent account:', e);
                            emailWarning = { type: 'PARENT_CREATION_FAILED', detail: e.message };
                        }
                    } else {
                        // Existing Parent Notification
                        const nRes = await safeSendEmail({
                            to: parentEmail,
                            subject: `Action requise - Convention de stage de ${data.eleve_prenom}`,
                            text: `Bonjour,\n\n` +
                                `Votre enfant ${data.eleve_prenom} ${data.eleve_nom} a signé sa convention de stage.\n` +
                                `En tant que représentant légal, votre signature est maintenant requise pour valider le document.\n\n` +
                                `Connectez-vous à votre espace Pledgeum pour signer : ${process.env.NEXT_PUBLIC_APP_URL || 'https://www.pledgeum.fr'}/login\n\n` +
                                `Cordialement,\nL'équipe Pledgeum`
                        });
                        if (nRes) emailWarning = nRes;
                    }
                }
            }


            const createdConvention = result.rows[0];

            return NextResponse.json({
                success: true,
                data: createdConvention,
                warning: emailWarning?.type,
                debugError: emailWarning?.detail
            });

        } catch (dbError: any) {
            await client.query('ROLLBACK');
            throw dbError;
        } finally {
            client.release();
        }

    } catch (error: any) {
        console.error('Create Convention Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
