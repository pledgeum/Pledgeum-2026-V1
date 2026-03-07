
import { Pool } from 'pg';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// Helper to send emails safely
const safeSendEmail = async (params: any) => {
    try {
        const { sendEmail } = await import('@/lib/email');
        const result = await sendEmail(params);
        if (!result.success) {
            console.error('[USER_PROVISIONING] Email Error:', result.error);
            return { type: 'EMAIL_FAILED', detail: result.error };
        }
        return null;
    } catch (e: any) {
        console.error('[USER_PROVISIONING] Email Exception:', e);
        return { type: 'EMAIL_EXCEPTION', detail: e.message };
    }
};

interface UserProvisioningParams {
    pool: Pool;
    email: string;
    role: 'parent' | 'tutor' | 'company_head';
    firstName: string;
    lastName: string;
    phone?: string;
    studentName?: string; // For email context
}

/**
 * Finds an existing user by email or creates a new one.
 * Sends a welcome email if a new user is created.
 * Returns the user's UID.
 */
export async function findOrCreateUser({
    pool,
    email,
    role,
    firstName,
    lastName,
    phone,
    studentName
}: UserProvisioningParams): Promise<{ uid: string; isNew: boolean; error?: any }> {
    const normalizedEmail = email.toLowerCase().trim();

    try {
        // 1. Check if user exists
        const userCheck = await pool.query('SELECT uid FROM users WHERE email = $1', [normalizedEmail]);
        if (userCheck.rowCount && userCheck.rowCount > 0) {
            return { uid: userCheck.rows[0].uid, isNew: false };
        }

        // 2. Create new user
        const tempPassword = Math.random().toString(36).slice(-8) + "Aa1!";
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        const newUid = crypto.randomUUID();

        // Ensure phone is not null
        const safePhone = phone || "";

        console.log(`[USER_PROVISIONING] Creating new user: ${normalizedEmail} (${role})`);

        await pool.query(
            `INSERT INTO users (
                uid, email, role, password_hash, must_change_password, 
                first_name, last_name, phone, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
            [newUid, normalizedEmail, role, hashedPassword, true, firstName, lastName, safePhone]
        );

        // 3. Send Welcome Email
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.pledgeum.fr';

        let emailSubject = "Bienvenue sur Pledgeum";
        let emailBody = `Bonjour ${firstName || 'Utilisateur'},\n\n` +
            `Un compte a été créé pour vous sur Pledgeum.\n\n` +
            `Voici vos identifiants :\n` +
            `Identifiant : ${normalizedEmail}\n` +
            `Mot de passe : ${tempPassword}\n\n` +
            `Connectez-vous ici : ${appUrl}/login\n\n` +
            `Cordialement,\nL'équipe Pledgeum`;

        // Contextualize email based on role
        if (role === 'parent' && studentName) {
            emailSubject = "Bienvenue sur Pledgeum - Votre compte Parent";
            emailBody = `Bonjour ${firstName || 'Parent'},\n\n` +
                `Suite à la signature de la convention de stage de votre enfant ${studentName}, un compte a été créé pour vous permettre de signer le document.\n\n` +
                `Voici vos identifiants :\n` +
                `Identifiant : ${normalizedEmail}\n` +
                `Mot de passe : ${tempPassword}\n\n` +
                `Veuillez vous connecter pour signer la convention : ${appUrl}/login\n\n` +
                `Cordialement,\nL'équipe Pledgeum`;
        } else if (role === 'tutor') {
            emailSubject = "Convention de stage - Création de compte Tuteur";
            emailBody = `Bonjour ${firstName || 'Tuteur'},\n\n` +
                `Vous avez été désigné comme tuteur de stage${studentName ? ` pour l'élève ${studentName}` : ''}.\n` +
                `Un compte a été créé pour vous permettre de suivre et signer la convention.\n\n` +
                `Voici vos identifiants :\n` +
                `Identifiant : ${normalizedEmail}\n` +
                `Mot de passe : ${tempPassword}\n\n` +
                `Connectez-vous ici : ${appUrl}/login\n\n` +
                `Cordialement,\nL'équipe Pledgeum`;
        } else if (role === 'company_head') {
            emailSubject = "Convention de stage - Création de compte Chef d'Entreprise";
            emailBody = `Bonjour ${firstName || "Chef d'Entreprise"},\n\n` +
                `Une convention de stage requiert votre signature${studentName ? ` pour l'élève ${studentName}` : ''}.\n` +
                `Un compte a été créé pour faciliter la gestion administrative.\n\n` +
                `Voici vos identifiants :\n` +
                `Identifiant : ${normalizedEmail}\n` +
                `Mot de passe : ${tempPassword}\n\n` +
                `Connectez-vous ici : ${appUrl}/login\n\n` +
                `Cordialement,\nL'équipe Pledgeum`;
        }

        await safeSendEmail({
            to: normalizedEmail,
            subject: emailSubject,
            text: emailBody
        });

        return { uid: newUid, isNew: true };

    } catch (error) {
        console.error('[USER_PROVISIONING] Error finding or creating user:', error);
        return { uid: '', isNew: false, error }; // Caller should handle empty UID
    }
}
