
import { NextResponse } from 'next/server';
import pool from '@/lib/pg';
// import { getServerSession } from "next-auth"; // REMOVED - using 'auth' from src/auth for v5 or compatible
import { auth } from "@/auth"; // Assuming auth.ts exists in src/ based on 'handlers' export seen in [...nextauth]
import crypto from 'crypto';
import { sendEmail } from '@/lib/email';
import { sendNotification, createInAppNotification } from '@/lib/notification';

// 📝 Étape 2 : Template Universel de Confirmation
function getSignatureConfirmationHtml(recipientName: string, studentName: string) {
    return `
        <div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 8px;">
            <h2 style="color: #2563eb;">Confirmation de signature électronique</h2>
            <p>Bonjour ${recipientName},</p>
            <p>Votre signature électronique pour la convention de stage de <strong>${studentName}</strong> a bien été enregistrée avec succès.</p>
            <p>Vous pouvez consulter l'état d'avancement du document et le télécharger une fois toutes les signatures réunies depuis votre espace Pledgeum.</p>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 0.9em; color: #666;">
                <p>Cordialement,<br/>L'équipe Pledgeum</p>
            </div>
        </div>
    `;
}

// 📭 Étape 1 : Dispatcher de Destinataires
function getRecipientInfo(role: string, convention: any) {
    const metadata = convention.metadata || {};
    const data = convention.data || {};
    
    // Hybrid extraction for backward compatibility
    const getField = (key: string) => metadata[key] || data[key];

    const studentName = getField('eleve_nom') ? `${getField('eleve_prenom')} ${getField('eleve_nom')}` : "l'élève";

    switch (role) {
        case 'student':
            return {
                email: getField('eleve_email'),
                name: getField('eleve_prenom') || studentName,
                studentName
            };
        case 'parent':
            return {
                email: getField('rep_legal_email'),
                name: getField('rep_legal_prenom') || "Responsable Légal",
                studentName
            };
        case 'teacher':
            return {
                email: getField('prof_suivi_email') || getField('teacher_email'),
                name: getField('prof_prenom') || "Enseignant Référent",
                studentName
            };
        case 'tutor':
            return {
                email: getField('tuteur_email'),
                name: getField('tuteur_prenom') || "Tuteur",
                studentName
            };
        case 'company_head':
        case 'company_head_tutor':
            return {
                email: getField('ent_rep_email') || getField('entreprise_directeur_email'),
                name: getField('ent_rep_prenom') || "Représentant Entreprise",
                studentName
            };
        case 'school_head':
            return {
                email: metadata.signatories?.principal?.email || getField('head_email'),
                name: metadata.signatories?.principal?.name || "Chef d'Établissement",
                studentName
            };
        default:
            return { email: null, name: null, studentName };
    }
}

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    // throw new Error("⛔ I AM THE ACTIVE FILE ⛔"); // TRACER TEST REMOVED
    try {
        const session = await auth();
        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: conventionId } = await params;
        const body = await req.json();
        const { role, signatureImage, code: providedCode, dualSign } = body;

        // Auto-generate code if missing (Robustness for UI that doesn't send it)
        const code = providedCode || Math.random().toString(36).substring(2, 10).toUpperCase();

        if (!role) {
            return NextResponse.json({ error: 'Role is required' }, { status: 400 });
        }

        // --- 1. Fetch Current Convention Data ---
        const convRes = await pool.query('SELECT metadata, status, student_uid FROM conventions WHERE id = $1', [conventionId]);
        if (convRes.rowCount === 0) {
            return NextResponse.json({ error: 'Convention not found' }, { status: 404 });
        }
        const convention = convRes.rows[0];
        const metadata = convention.metadata || {};
        const sigs = metadata.signatures || {};

        // --- 2. Secure Age Calculation ---
        let isMinor = metadata.est_mineur;
        if (metadata.eleve_date_naissance) {
            const birthDate = new Date(metadata.eleve_date_naissance);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            isMinor = age < 18;
        }

        // --- 3. Prerequisites Guards ---
        if (role === 'parent') {
            if (!isMinor) return NextResponse.json({ error: "L'élève est majeur, la signature parentale n'est pas requise." }, { status: 400 });
            if (!sigs.student) return NextResponse.json({ error: "L'élève doit signer en premier." }, { status: 400 });
        }

        if (role === 'teacher') {
            if (!sigs.student) return NextResponse.json({ error: "L'élève doit signer en premier." }, { status: 400 });
        }

        if (role === 'tutor' || role === 'company_head' || role === 'company_head_tutor') {
            if (!sigs.teacher) return NextResponse.json({ error: "L'enseignant référent doit signer en premier." }, { status: 400 });
            if (isMinor && !sigs.parent) return NextResponse.json({ error: "Le représentant légal doit signer avant que l'entreprise ne puisse signer." }, { status: 400 });
        }

        if (role === 'school_head') {
            if (!sigs.teacher) return NextResponse.json({ error: "L'enseignant référent doit signer en premier." }, { status: 400 });
            if (isMinor && !sigs.parent) return NextResponse.json({ error: "Le représentant légal doit signer en premier." }, { status: 400 });
            // Strict check: if NOT Dual Sign, BOTH tutor and company must have signed (if they are separate).
            // Actually, the simplest check is: are both tutor and company signatures present?
            if (!sigs.tutor || !sigs.company_head) {
                return NextResponse.json({ error: "L'entreprise et le tuteur doivent avoir signé avant la validation finale." }, { status: 400 });
            }
        }

        // --- 4. Determine New Status & Metadata Updates ---
        const now = new Date().toISOString();
        const getIp = (req: Request) => {
            const clientIp = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
            return clientIp === '::1' ? '127.0.0.1 (Localhost)' : clientIp;
        };
        const ip = getIp(req);

        const generateSignatureHash = (role: string, timestamp: string, code: string) => {
            const hashInput = `${conventionId}:${role}:${timestamp}:${code}`;
            return crypto.createHash('sha256').update(hashInput).digest('hex');
        };

        const STATUS_WEIGHT: Record<string, number> = {
            'DRAFT': 0,
            'SUBMITTED': 1,
            'SIGNED_PARENT': 2,
            'VALIDATED_TEACHER': 3,
            'SIGNED_COMPANY': 4,
            'SIGNED_TUTOR': 5,
            'VALIDATED_HEAD': 6,
            'COMPLETED': 7
        };

        let newStatus = null;
        let metadataUpdates: any = {};
        let auditLog: any = null;
        let emailWarning: { type: string, detail: string } | null = null;

        // Helper to map role to fields
        // Note: We are merging into the JSONB 'metadata' column for these fields as per Hybrid Schema.
        switch (role) {
            case 'student':
                newStatus = 'SUBMITTED'; // Simplification: Student signing moves to submitted
                const studentHash = generateSignatureHash('student', now, code);
                // Use JSONB set/merge strategy or just replace the specific key if the ORM supports it.
                // Here we construct a patch. In a real JSONB update, we might need a deep merge.
                // But since we are updating the 'signatures' column (or metadata.signatures),
                // we should be careful not to wipe others.
                // However, the previous logic was `signatures: { ... }` which implies a merge at the ORM level
                // or that we need to fetch existing first.
                // Assuming the update mechanism handles a merge of `metadata.signatures`, or we are providing the delta.
                // Given the previous code, it seems to expect a merge. Let's stick to the structure.

                metadataUpdates = {
                    signatures: {
                        student: {
                            signedAt: now,
                            img: signatureImage,
                            code: code,
                            signatureId: code,
                            hash: studentHash,
                            ip: ip,
                            // integrity: 'SHA-256' // Now implicit in hash field or add if needed in schema
                        }
                    }
                };

                auditLog = {
                    date: now,
                    action: 'SIGNED',
                    actorEmail: session.user.email || 'student',
                    details: 'Signature Élève/Étudiant',
                    ip: ip
                };

                // --- AUTO-ONBOARDING PARENT LOGIC ---
                // Fetch convention details to get Parent Info
                try {
                    console.log(`[SIGN_DEBUG] Starting signature process for convention: ${conventionId}`);
                    const convRes = await pool.query(`SELECT metadata FROM conventions WHERE id = $1`, [conventionId]);
                    if (convRes.rows.length > 0) {
                        const conv = convRes.rows[0].metadata || {};

                        // Only if minor and parent email exists
                        if (conv.est_mineur && conv.rep_legal_email) {
                            const parentEmail = conv.rep_legal_email.toLowerCase().trim();
                            console.log(`[SIGN_DEBUG] Parent Email found: ${parentEmail} (Type: ${typeof parentEmail})`);

                            // Check if parent user exists
                            const userCheck = await pool.query('SELECT id FROM users WHERE email = $1', [parentEmail]);
                            const exists = userCheck.rowCount !== null && userCheck.rowCount > 0;
                            console.log(`[SIGN_DEBUG] Parent Account Status: ${exists ? 'Exists' : 'New'}`);

                            if (!exists) {
                                console.log(`[Auto-Onboard] Creating account for parent: ${parentEmail}`);

                                // Generate Temp Password
                                const tempPassword = Math.random().toString(36).slice(-8) + "Aa1!"; // Ensure some complexity
                                const bcrypt = await import('bcryptjs'); // Dynamic import
                                const hashedPassword = await bcrypt.hash(tempPassword, 10);

                                // Insert Parent User
                                const parentName = conv.rep_legal_prenom ? `${conv.rep_legal_prenom} ${conv.rep_legal_nom}` : conv.rep_legal_nom;
                                const firstName = conv.rep_legal_prenom || parentName.split(' ')[0];
                                const lastName = conv.rep_legal_nom || parentName.split(' ').slice(1).join(' ');
                                const phone = conv.rep_legal_tel || "";

                                await pool.query(
                                    `INSERT INTO users (
                                        email, role, password_hash, must_change_password, 
                                        first_name, last_name, phone, created_at, updated_at
                                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
                                    [parentEmail, 'parent', hashedPassword, true, firstName, lastName, phone]
                                );

                                // Send Welcome Email with Temp Password
                                console.log(`[SIGN_DEBUG] Attempting to send Welcome Email to Parent...`);
                                try {
                                    const welcomeResult = await sendEmail({
                                        to: parentEmail,
                                        subject: "Bienvenue sur Pledgeum - Votre compte Parent a été créé",
                                        text: `Bonjour ${firstName || 'Parent'},\n\n` +
                                            `Suite à la signature de la convention de stage de votre enfant ${conv.eleve_prenom} ${conv.eleve_nom}, un compte a été automatiquement créé pour vous permettre de signer le document.\n\n` +
                                            `Voici vos identifiants de connexion :\n` +
                                            `Identifiant : ${parentEmail}\n` +
                                            `Mot de passe temporaire : ${tempPassword}\n\n` +
                                            `Veuillez vous connecter dès maintenant pour changer votre mot de passe et finaliser la signature : ${process.env.NEXT_PUBLIC_APP_URL || 'https://www.pledgeum.fr'}/login\n\n` +
                                            `Cordialement,\nL'équipe Pledgeum`
                                    });
                                    console.log(`[SIGN_DEBUG] Welcome Email sent result:`, welcomeResult);
                                    if (!welcomeResult.success) {
                                        console.error(`[SIGN_DEBUG] Welcome Email Failed: ${welcomeResult.error}`);
                                        emailWarning = { type: 'EMAIL_FAILED', detail: welcomeResult.error || 'Unknown Error' };
                                    }
                                } catch (e: any) {
                                    console.error(`[SIGN_DEBUG] Failed to send Welcome Email:`, e);
                                }
                            } else {
                                // [NEW] Notify Existing Parent
                                console.log(`[Sign] Notifying existing parent: ${parentEmail}`);
                                console.log(`[SIGN_DEBUG] Attempting to send Notification Email to Parent...`);
                                try {
                                    const notifResult = await sendEmail({
                                        to: parentEmail,
                                        subject: `Action requise - Convention de stage de ${conv.eleve_prenom}`,
                                        text: `Bonjour,\n\n` +
                                            `Votre enfant ${conv.eleve_prenom} ${conv.eleve_nom} a signé sa convention de stage.\n` +
                                            `En tant que représentant légal, votre signature est maintenant requise pour valider le document.\n\n` +
                                            `Connectez-vous à votre espace Pledgeum pour signer : ${process.env.NEXT_PUBLIC_APP_URL || 'https://www.pledgeum.fr'}/login\n\n` +
                                            `Cordialement,\nL'équipe Pledgeum`
                                    });
                                    console.log(`[SIGN_DEBUG] Email Service Response:`, notifResult);
                                    if (!notifResult.success) {
                                        emailWarning = { type: 'EMAIL_FAILED', detail: notifResult.error || 'Unknown Error' };
                                    }
                                } catch (emailError: any) {
                                    console.error(`[SIGN_DEBUG] ERROR sending email: ${emailError.message}`);
                                }
                            }
                        }
                    }
                } catch (e: any) {
                    console.error("[Auto-Onboard] Failed to onboard parent:", e);
                    console.error(`[SIGN_DEBUG] ERROR inside catch block: ${e.message}`);
                    // Do not block the signature flow if onboarding fails
                }
                // ------------------------------------
                break;
            case 'parent':
                newStatus = 'SIGNED_PARENT';
                const parentHash = generateSignatureHash('parent', now, code);
                metadataUpdates = {
                    signatures: {
                        parent: {
                            signedAt: now,
                            img: signatureImage,
                            code: code,
                            signatureId: code,
                            hash: parentHash,
                            ip: ip,
                        }
                    }
                };

                auditLog = {
                    date: now,
                    action: 'SIGNED',
                    actorEmail: session.user.email || 'parent',
                    details: 'Signature Responsable Légal (Parent)',
                    ip: ip
                };
                break;
            case 'teacher':
                newStatus = 'VALIDATED_TEACHER';
                const teacherHash = generateSignatureHash('teacher', now, code);
                metadataUpdates = {
                    signatures: {
                        teacher: {
                            signedAt: now,
                            img: signatureImage,
                            code: code,
                            signatureId: code,
                            hash: teacherHash,
                            ip: ip,
                            integrity: 'SHA-256' // Standardized
                        }
                    }
                };

                auditLog = {
                    date: now,
                    action: 'SIGNED',
                    actorEmail: session.user.email || 'teacher',
                    details: 'Validation et Signature Enseignant Référent',
                    ip: ip
                };

                // --- EMAIL TRIGGER: Notify Company/Tutor ---
                try {
                    const convRes = await pool.query(`SELECT metadata FROM conventions WHERE id = $1`, [conventionId]);
                    if (convRes.rows.length > 0) {
                        const convData = convRes.rows[0].metadata || {};
                        const tutorEmail = convData.tuteur_email;
                        const entEmail = convData.ent_rep_email;
                        // Use a Set to avoid duplicate emails if tutor == rep
                        const recipients = new Set<string>();
                        if (tutorEmail) recipients.add(tutorEmail.toLowerCase().trim());
                        if (entEmail) recipients.add(entEmail.toLowerCase().trim());

                        if (recipients.size > 0) {
                            console.log(`[Sign] Teacher signed. Notifying Company/Tutor:`, Array.from(recipients));
                            const { sendEmail } = await import('@/lib/email');

                            const subject = `Action requise : Signature de la convention de ${convData.eleve_prenom} ${convData.eleve_nom}`;
                            const message = `Bonjour,\n\n` +
                                `L'enseignant référent a validé et signé la convention de stage de ${convData.eleve_prenom} ${convData.eleve_nom}.\n` +
                                `Votre signature est maintenant requise pour finaliser le document.\n\n` +
                                `Connectez-vous à votre espace Pledgeum pour signer : ${process.env.NEXT_PUBLIC_APP_URL || 'https://www.pledgeum.fr'}/login\n\n` +
                                `Cordialement,\nL'équipe Pledgeum`;

                            for (const recipient of recipients) {
                                try {
                                    const emailRes = await sendEmail({ to: recipient, subject, text: message });
                                    if (!emailRes.success) {
                                        console.error(`[Sign] Failed to email ${recipient}:`, emailRes.error);
                                        emailWarning = { type: 'EMAIL_FAILED', detail: emailRes.error || 'Unknown Error' };
                                    }
                                } catch (e: any) {
                                    console.error(`[Sign] Error sending to ${recipient}:`, e);
                                }
                            }
                        }
                    }
                } catch (e: any) {
                    console.error("[Sign] Failed to process Teacher email trigger:", e);
                }
                break;
            // For Company/Tutor/Head, we might update dedicated columns OR metadata depending on the exact requirement.
            // The user request specifically mentioned updating metadata for student/parent/teacher legacy fields.
            // But let's handle the others for completeness if they come through this route.
            case 'company_head':
            case 'tutor':
            case 'company_head_tutor':
                // Final status for Company/Tutor phase is SIGNED_TUTOR if both are done.
                // If dualSign is checked, we force moving to SIGNED_TUTOR.
                newStatus = dualSign ? 'SIGNED_TUTOR' : (role === 'company_head' ? 'SIGNED_COMPANY' : 'SIGNED_TUTOR');

                const signatureHash = generateSignatureHash(role, now, code);
                const signatureData = {
                    signedAt: now,
                    img: signatureImage,
                    code: code,
                    signatureId: code,
                    hash: signatureHash,
                    ip: ip,
                };

                let signatureMetadata: any = {};

                // If dualSign is active, we populate BOTH keys in metadata.signatures
                if (dualSign) {
                    signatureMetadata.tutor = signatureData;
                    signatureMetadata.company_head = signatureData;
                } else {
                    // Otherwise, only the acting role (map company_head_tutor to tutor if not dual)
                    const sigKey = role === 'company_head' ? 'company_head' : 'tutor';
                    signatureMetadata[sigKey] = signatureData;
                }

                metadataUpdates = { signatures: signatureMetadata };

                auditLog = {
                    date: now,
                    action: 'SIGNED',
                    actorEmail: session.user.email || role,
                    details: dualSign ? 'Signature cumulée (Entreprise & Tuteur)' : `Signature ${role}`,
                    ip: ip
                };
                break;
            case 'school_head':
            case 'ddfpt':
            case 'at_ddfpt':
            case 'business_manager':
            case 'assistant_manager':
            case 'stewardship_secretary':
            case 'ESTABLISHMENT_ADMIN':
                newStatus = 'VALIDATED_HEAD';
                const headHash = generateSignatureHash('school_head', now, code);

                // --- Document Seal (Certificate Hash) ---
                // We compute the final hash that will be on the PDF
                let finalCertHash = null;
                try {
                    const { generateVerificationUrl: genUrl } = await import('@/app/actions/sign');
                    // Fetch FULL convention safely
                    const convRes = await pool.query(`SELECT * FROM conventions WHERE id = $1`, [conventionId]);
                    if (convRes.rows.length > 0) {
                        const dbRow = convRes.rows[0];
                        // Merge metadata into root as the Store does, ensuring names and dates are present
                        const mockConvForHash = {
                            ...dbRow,
                            ...(dbRow.metadata || {}),
                            id: conventionId,
                            signatures: {
                                ...(dbRow.metadata?.signatures || {}),
                                head: { signedAt: now, hash: headHash, code: code }
                            }
                        };
                        const { hashDisplay } = await genUrl(mockConvForHash as any, 'convention');
                        finalCertHash = hashDisplay;
                    }
                } catch (e) {
                    console.error("[Sign] Failed to compute final cert hash:", e);
                }

                metadataUpdates = {
                    certificateHash: finalCertHash,
                    signatures: {
                        head: {
                            signedAt: now,
                            img: signatureImage,
                            code: code,
                            signatureId: code,
                            hash: headHash,
                            ip: ip,
                        }
                    }
                };

                auditLog = {
                    date: now,
                    action: 'SIGNED',
                    actorEmail: session.user.email || 'school_head',
                    details: 'Signature Chef d\'Établissement (Validation Finale)',
                    ip: ip
                };
                // Also pass pdfHash to the workflow helper to update the column
                if (finalCertHash) {
                    metadataUpdates.pdfHash = finalCertHash;
                }
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

            const currentWeight = convention.status ? (STATUS_WEIGHT[convention.status] || 0) : 0;
            const newWeight = statusToApply ? (STATUS_WEIGHT[statusToApply] || 0) : 0;

            // Règle d'or : On ne recule jamais.
            statusToApply = (newWeight > currentWeight) ? statusToApply : convention.status;

            const updatedConvention = await updateConventionStatus(
                conventionId,
                statusToApply as any,
                {
                    signatures: metadataUpdates.signatures,
                    pdfHash: metadataUpdates.pdfHash, // Important: updates the dedicated column
                    auditLog: auditLog, // Persist signature event
                    signer: role === 'school_head' ? {
                        email: session.user.email || 'unknown',
                        name: (session.user as any).name || session.user.email || "Chef d'établissement",
                        function: "Chef d'établissement"
                    } : undefined
                }
            );

            // --- 🎯 communication & notifications (NON-BLOCKING) ---
            const metadata = updatedConvention.metadata || {};
            const data = updatedConvention.data || {};
            const getField = (key: string) => metadata[key] || data[key];
            const sigs = metadata.signatures || {};

            const studentEmail = getField('eleve_email');
            const parentEmail = getField('rep_legal_email');
            const studentName = getField('eleve_nom') ? `${getField('eleve_prenom')} ${getField('eleve_nom')}` : "l'élève";
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.pledgeum.fr';

            const notificationTasks: Promise<any>[] = [];

            // 1. NOTIFICATIONS ENTREPRISE (Triggered by Teacher/School Head)
            const isTeacherValidated = (statusToApply === 'VALIDATED_TEACHER' || currentWeight >= 3);
            const isCompanyTurn = isTeacherValidated && (!sigs.tutor || !sigs.company_head);
            const isDirectTrigger = (role === 'teacher' || (role === 'school_head' && isCompanyTurn));

            if (isCompanyTurn && isDirectTrigger) {
                const tutorEmail = metadata.tuteur_email || metadata.tutor?.email;
                const headEmail = metadata.ent_rep_email || metadata.signatories?.head?.email;

                if (tutorEmail && !sigs.tutor) {
                    notificationTasks.push(sendEmail({
                        to: tutorEmail,
                        subject: `[Action Requise] Convention de stage à signer - ${studentName}`,
                        text: `Bonjour,\n\nLa convention de stage de ${studentName} requiert votre signature en tant que Tuteur.\nVous pouvez la consulter et la signer sur votre espace :\n${appUrl}/login\n\nCordialement,\nL'équipe Pledgeum`
                    }).catch(e => console.error("[Notif] Tutor email failed", e)));
                }

                if (headEmail && !sigs.company_head && tutorEmail !== headEmail) {
                    notificationTasks.push(sendEmail({
                        to: headEmail,
                        subject: `[Action Requise] Convention de stage à signer - ${studentName}`,
                        text: `Bonjour,\n\nLa convention de stage de ${studentName} requiert votre signature en tant que Chef d'Entreprise.\nVous pouvez la consulter et la signer sur votre espace :\n${appUrl}/login\n\nCordialement,\nL'équipe Pledgeum`
                    }).catch(e => console.error("[Notif] Head email failed", e)));
                }
            }

            // 2. Signature Confirmation Email (UNIVERSAL for current signer)
            const recipient = getRecipientInfo(role, updatedConvention);
            if (recipient && recipient.email) {
                console.log(`[Universal Email] Sending confirmation to ${role}: ${recipient.email}`);
                notificationTasks.push((async () => {
                    try {
                        await sendEmail({
                            to: recipient.email,
                            subject: `Confirmation de signature - ${recipient.studentName}`,
                            text: `Bonjour, Votre signature électronique pour la convention de stage de ${recipient.studentName} a bien été enregistrée avec succès. Vous pouvez consulter l'état d'avancement du document depuis votre espace.`,
                            html: getSignatureConfirmationHtml(recipient.name || "Signataire", recipient.studentName)
                        } as any);
                    } catch (emailErr) {
                        console.error("[Universal Email] SIGNER confirmation failed:", emailErr);
                    }
                })());
            }

            // 3. Notify Student on any third-party signature
            if (role !== 'student' && studentEmail) {
                const subject = `Nouvelle signature sur votre convention - ${studentName}`;
                const message = `Bonjour ${getField('eleve_prenom') || 'élève'},\n\nUne nouvelle signature (${role}) a été apposée sur votre convention de stage. Vous pouvez suivre l'état d'avancement ici : ${appUrl}/dashboard`;
                
                notificationTasks.push(sendNotification(studentEmail, subject, message).catch(e => console.error("[Notif] Student notification failed", e)));
                
                if (updatedConvention.student_uid) {
                    notificationTasks.push(createInAppNotification(updatedConvention.student_uid, subject, message).catch(e => console.error("[Notif] Student In-App failed", e)));
                }
            }

            // 4. Notify Parent on any third-party signature (if minor)
            if (role !== 'parent' && getField('est_mineur') && parentEmail) {
                const subject = `Suivi convention - Nouvelle signature pour ${studentName}`;
                const message = `Bonjour, La convention de stage de ${studentName} vient de recevoir une nouvelle signature (${role}). Prochaine étape : voir le tableau de bord.`;
                
                notificationTasks.push(sendEmail({ to: parentEmail, subject, text: message }).catch(e => console.error("[Notif] Parent notification failed", e)));
            }

            // Execute all notifications without blocking the response
            Promise.allSettled(notificationTasks).then(results => {
                const failures = results.filter(r => r.status === 'rejected');
                console.log(`[Notification Engine] Finished ${results.length} tasks. Failures: ${failures.length}`);
            });

            return NextResponse.json({
                success: true,
                data: updatedConvention,
                warning: emailWarning?.type,
                debugError: emailWarning?.detail
            });

        } catch (error: any) {
            console.error('Sign API via Workflow Error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
