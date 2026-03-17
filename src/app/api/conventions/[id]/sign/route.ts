
import { NextResponse } from 'next/server';
import pool from '@/lib/pg';
// import { getServerSession } from "next-auth"; // REMOVED - using 'auth' from src/auth for v5 or compatible
import { auth } from "@/auth"; // Assuming auth.ts exists in src/ based on 'handlers' export seen in [...nextauth]
import crypto from 'crypto';
import { sendEmail } from '@/lib/email';
import { sendNotification, createInAppNotification } from '@/lib/notification';

const ROLE_LABELS: Record<string, string> = {
    'student': "L'élève",
    'tutor': "Le tuteur de stage",
    'company_head': "Le représentant de l'entreprise",
    'company_head_tutor': "Le représentant de l'entreprise et tuteur",
    'teacher': "L'enseignant référent",
    'school_head': "Le chef d'établissement",
    'rep_legal': "Le représentant légal",
    'parent': "Le représentant légal"
};

function getSignerIdentity(role: string, convention: any) {
    const metadata = convention.metadata || {};
    const data = convention.data || {};
    const get = (k: string) => metadata[k] || data[k];

    const label = ROLE_LABELS[role] || role;
    
    let name = "";
    if (role === 'student') name = `${get('eleve_prenom') || ''} ${get('eleve_nom') || ''}`;
    else if (role === 'parent' || role === 'rep_legal') name = `${get('rep_legal_prenom') || ''} ${get('rep_legal_nom') || ''}`;
    else if (role === 'teacher') name = `${get('prof_prenom') || ''} ${get('prof_nom') || ''}`;
    else if (role === 'tutor') name = `${get('tuteur_prenom') || ''} ${get('tuteur_nom') || ''}`;
    else if (role === 'company_head' || role === 'company_head_tutor') name = `${get('ent_rep_prenom') || ''} ${get('ent_rep_nom') || ''}`;
    else if (role === 'school_head') name = metadata.signatories?.principal?.name || `${get('head_prenom') || ''} ${get('head_nom') || ''}`;

    const trimmedName = name.trim();
    return trimmedName ? `${label} ${trimmedName}` : label;
}

// 📝 Étape 2 : Template Universel de Confirmation
function getSignatureConfirmationHtml(
    recipientName: string, 
    studentName: string, 
    signerIdentity: string,
    companyName?: string,
    companyCity?: string,
    period?: string
) {
    const context = (companyName && companyCity && period) 
        ? `<p style="background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; color: #475569; font-size: 0.95em;">
             La convention de stage au sein de <strong>${companyName}</strong> à <strong>${companyCity}</strong>, 
             pour la période du <strong>${period}</strong>, a été signée par <strong>${signerIdentity}</strong>.
           </p>`
        : `<p>La convention de stage de <strong>${studentName}</strong> vient de recevoir une nouvelle signature de la part de <strong>${signerIdentity}</strong>.</p>`;

    return `
        <div style="font-family: sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 30px; border-radius: 12px; background: white;">
            <h2 style="color: #2563eb; margin-top: 0; font-size: 1.5em; letter-spacing: -0.02em;">Signature enregistrée ✅</h2>
            <p style="font-size: 1.1em;">Bonjour ${recipientName},</p>
            ${context}
            <p>Votre signature électronique a bien été enregistrée avec succès.</p>
            <p>Vous pouvez consulter l'état d'avancement du document et le télécharger une fois toutes les signatures réunies depuis votre espace Pledgeum.</p>
            <div style="margin-top: 30px; padding-top: 25px; border-top: 1px solid #f1f5f9; font-size: 0.9em; color: #64748b;">
                <p><strong>L'équipe Pledgeum</strong><br/>Service de Gestion des PFMP</p>
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
        const { role, signatureImage, code: providedCode, dualSign, newCompanyHeadEmail } = body;


        // Auto-generate code if missing (Robustness for UI that doesn't send it)
        const code = providedCode || Math.random().toString(36).substring(2, 10).toUpperCase();

        if (!role) {
            return NextResponse.json({ error: 'Role is required' }, { status: 400 });
        }

        // --- 0.5 REGEX VALIDATION for delegation email ---
        if (role === 'tutor' && !dualSign && newCompanyHeadEmail) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(newCompanyHeadEmail)) {
                return NextResponse.json({ error: "L'adresse email du représentant légal est invalide." }, { status: 400 });
            }
        }


        // --- 1. Fetch Current Convention Data ---
        const convRes = await pool.query('SELECT metadata, status, student_uid FROM conventions WHERE id = $1', [conventionId]);
        if (convRes.rowCount === 0) {
            return NextResponse.json({ error: 'Convention not found' }, { status: 404 });
        }
        const convention = convRes.rows[0];
        const metadata = convention.metadata || {};
        const sigs = metadata.signatures || {};

        if (convention.status === 'REJECTED') {
            const rejectedBy = metadata.rejectedByLabel || "un signataire";
            return NextResponse.json({ error: `Cette convention a été refusée par ${rejectedBy} et ne peut plus être signée.` }, { status: 400 });
        }

        // --- 1.5 IDENTITY VERIFICATION (Zero-Trust) ---
        if (!session.user.email) {
            return NextResponse.json({ error: "Email de session manquant." }, { status: 401 });
        }
        const userEmail = session.user.email.toLowerCase().trim();
        const sessionRole = session.user.role;
        
        // Map of allowed roles based on email match
        const allowedSignatories: Record<string, string> = {
            [metadata.eleve_email?.toLowerCase().trim()]: 'student',
            [metadata.rep_legal_email?.toLowerCase().trim()]: 'parent',
            [metadata.prof_email?.toLowerCase().trim()]: 'teacher',
            [metadata.prof_suivi_email?.toLowerCase().trim()]: 'teacher',
            [metadata.tuteur_email?.toLowerCase().trim()]: 'tutor',
            [metadata.ent_rep_email?.toLowerCase().trim()]: 'company_head',
            [metadata.signatories?.principal?.email?.toLowerCase().trim()]: 'school_head'
        };

        let resolvedRole = allowedSignatories[userEmail];

        // Authorization for Establishment Admins/Heads who might not be the explicit signatory but have the right to sign
        const schoolAdminRoles = ['school_head', 'ddfpt', 'at_ddfpt', 'business_manager', 'assistant_manager', 'stewardship_secretary', 'ESTABLISHMENT_ADMIN'];
        if (!resolvedRole && (schoolAdminRoles.includes(sessionRole) || sessionRole === 'admin' || sessionRole === 'SUPER_ADMIN')) {
            if (['school_head', 'ddfpt', 'teacher'].includes(role)) {
                resolvedRole = role; // Trust the requested role ONLY because the session role is high-privilege
            }
        }

        if (!resolvedRole) {
            return NextResponse.json({ error: "Votre email ne correspond à aucun signataire autorisé pour cette convention." }, { status: 403 });
        }

        // Cross-check resolvedRole with requested role to prevent mismatch (except for dual signatures)
        if (role !== resolvedRole) {
            const isCompanySwap = (resolvedRole === 'company_head' && role === 'tutor') || (resolvedRole === 'tutor' && role === 'company_head');
            const isDualRole = role === 'company_head_tutor' && (resolvedRole === 'tutor' || resolvedRole === 'company_head');
            
            if (!isCompanySwap && !isDualRole && !schoolAdminRoles.includes(sessionRole)) {
                return NextResponse.json({ error: `Tentative d'usurpation de rôle détectée.` }, { status: 403 });
            }
        }

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
        const notificationTasks: Promise<any>[] = [];


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

                // --- 🎯 NEW: Dynamic Delegation Logic (Tutor -> Split) ---
                if (role === 'tutor' && !dualSign && newCompanyHeadEmail) {
                    const cleanEmail = newCompanyHeadEmail.toLowerCase().trim();
                    
                    // 1. Update metadata in the object we're about to save
                    metadataUpdates.is_tutor_company_head = false;
                    metadataUpdates.ent_rep_email = cleanEmail;

                    // 2. Perform out-of-band SQL update for the dedicated column to ensure sync
                    // We do this inside a try/catch to not block the main flow if it's already updated by metadata merge
                    try {
                        await pool.query(
                            'UPDATE conventions SET ent_rep_email = $1 WHERE id = $2',
                            [cleanEmail, conventionId]
                        );
                    } catch (sqlErr) {
                        console.error("[DELEGATION] Failed to update SQL column directly:", sqlErr);
                    }

                    // 3. Trigger Invitation Email for the NEW Company Head
                    const studentName = getRecipientInfo('student', convention).studentName || "l'élève";
                    const tutorName = getRecipientInfo('tutor', convention).name || "Votre tuteur";
                    
                    notificationTasks.push((async () => {
                        try {
                            const inviteResult = await sendEmail({
                                to: cleanEmail,
                                subject: `Action requise : Signature de la convention de ${studentName} (Délégation)`,
                                text: `Bonjour,\n\n` +
                                    `${tutorName} a signé la convention de stage de ${studentName} en tant que tuteur.\n` +
                                    `Cependant, celui-ci a indiqué que vous êtes le représentant légal habilité à signer pour l'entreprise.\n\n` +
                                    `Votre signature est maintenant requise pour finaliser le document.\n` +
                                    `Connectez-vous à votre espace Pledgeum : ${process.env.NEXT_PUBLIC_APP_URL || 'https://www.pledgeum.fr'}/login\n\n` +
                                    `Cordialement,\nL'équipe Pledgeum`
                            });
                            if (!inviteResult.success) console.error("[DELEGATION] Email failed:", inviteResult.error);
                        } catch (e) {
                            console.error("[DELEGATION] Export error:", e);
                        }
                    })());
                }
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
                        text: `Bonjour,\n\nLa convention de stage de ${studentName} requiert votre signature en tant que Tuteur de stage.\nVous pouvez la consulter et la signer sur votre espace :\n${appUrl}/login\n\nCordialement,\nL'équipe Pledgeum`
                    }).catch(e => console.error("[Notif] Tutor email failed", e)));
                }

                if (headEmail && !sigs.company_head && tutorEmail !== headEmail) {
                    notificationTasks.push(sendEmail({
                        to: headEmail,
                        subject: `[Action Requise] Convention de stage à signer - ${studentName}`,
                        text: `Bonjour,\n\nLa convention de stage de ${studentName} requiert votre signature en tant que Représentant de l'entreprise.\nVous pouvez la consulter et la signer sur votre espace :\n${appUrl}/login\n\nCordialement,\nL'équipe Pledgeum`
                    }).catch(e => console.error("[Notif] Head email failed", e)));
                }
            }

            // 🎯 NEW: Broadcast Notification to All Parties
            const recipient = getRecipientInfo(role, updatedConvention);
            const signerIdentity = getSignerIdentity(role, updatedConvention);
            const companyName = metadata.ent_nom || metadata.company_name;
            const companyCity = metadata.ent_ville || metadata.company_city;
            const period = (metadata.stage_date_debut && metadata.stage_date_fin) 
                ? `${new Date(metadata.stage_date_debut).toLocaleDateString('fr-FR')} au ${new Date(metadata.stage_date_fin).toLocaleDateString('fr-FR')}`
                : undefined;

            const structuredRecipients: { role: string; email: string }[] = [];
            
            if (recipient?.email) {
                structuredRecipients.push({ 
                    role: "Signataire actuel", 
                    email: recipient.email.toLowerCase().trim() 
                });
            }
            if (studentEmail && !structuredRecipients.some(r => r.email === studentEmail.toLowerCase())) {
                structuredRecipients.push({ 
                    role: "Élève", 
                    email: studentEmail.toLowerCase().trim() 
                });
            }
            if (parentEmail && !structuredRecipients.some(r => r.email === parentEmail.toLowerCase())) {
                structuredRecipients.push({ 
                    role: "Représentant légal", 
                    email: parentEmail.toLowerCase().trim() 
                });
            }

            for (const item of structuredRecipients) {
                notificationTasks.push((async () => {
                    try {
                        const isCurrentSigner = item.role === "Signataire actuel";
                        await sendEmail({
                            to: item.email,
                            subject: isCurrentSigner 
                                ? `Confirmation de signature - ${recipient?.studentName}`
                                : `Suivi signature - Convention de ${recipient?.studentName}`,
                            text: `Le stage chez ${companyName} (${companyCity}) du ${period} a reçu une nouvelle signature.`,
                            html: getSignatureConfirmationHtml(
                                isCurrentSigner ? (recipient?.name || "Signataire") : "Madame, Monsieur",
                                recipient?.studentName || "l'élève",
                                signerIdentity,
                                companyName,
                                companyCity,
                                period
                            )
                        } as any);
                    } catch (emailErr) {
                        console.error(`[Broadcast Email] Failed for ${item.email}:`, emailErr);
                    }
                })());
            }

            // Execute all notifications without blocking the response
            Promise.allSettled(notificationTasks).then(results => {
                const failures = results.filter(r => r.status === 'rejected');
                console.log(`[Notification Engine] Finished ${results.length} tasks. Failures: ${failures.length}`);
            });

            return NextResponse.json({
                success: true,
                data: updatedConvention,
                recipients: structuredRecipients, // Return structured objects
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
