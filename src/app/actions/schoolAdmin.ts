'use server';

import { adminAuth, adminFirestore } from '@/lib/firebase-admin';
import { sendEmail } from '@/lib/email';
import pool from '@/lib/pg';

export async function initializeSchoolIdentity(schoolId: string, data: {
    name: string;
    address: string;
    city: string;
    postalCode: string;
    email: string;
    phone?: string;
    status: 'BETA' | 'ADHERENT';
    uai?: string;
    adminEmail?: string;
}) {
    try {
        console.log(`[Initialize School] Starting for ${data.name} (${schoolId}) - Status: ${data.status} - UAI: ${data.uai}`);

        await adminFirestore.collection('schools').doc(schoolId).set({
            schoolName: data.name,
            schoolAddress: data.address,
            schoolCity: data.city, // If address is full string, this might be redundant but keeping for schema consistency
            schoolPostalCode: data.postalCode,
            schoolHeadEmail: data.adminEmail || data.email, // Priority to explicit adminEmail
            schoolPhone: data.phone || '',
            schoolUai: data.uai || schoolId,
            updatedAt: new Date().toISOString(),
            isAuthorized: true,
            schoolStatus: data.status // 'validated' from prompt maps to 'ADHERENT' here
        }, { merge: true });

        // 2. Persist to PostgreSQL (NEW)
        try {
            const client = await pool.connect();
            try {
                const upsertQuery = `
                    INSERT INTO establishments (uai, name, address, city, postal_code, telephone, admin_email, subscription_status)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    ON CONFLICT (uai) DO UPDATE 
                    SET 
                        name = EXCLUDED.name,
                        address = CASE WHEN EXCLUDED.address <> '' THEN EXCLUDED.address ELSE establishments.address END,
                        city = CASE WHEN EXCLUDED.city <> '' THEN EXCLUDED.city ELSE establishments.city END,
                        postal_code = CASE WHEN EXCLUDED.postal_code <> '' THEN EXCLUDED.postal_code ELSE establishments.postal_code END,
                        telephone = CASE WHEN EXCLUDED.telephone <> '' THEN EXCLUDED.telephone ELSE establishments.telephone END,
                        admin_email = CASE WHEN EXCLUDED.admin_email IS NOT NULL AND EXCLUDED.admin_email <> '' THEN EXCLUDED.admin_email ELSE establishments.admin_email END,
                        subscription_status = EXCLUDED.subscription_status,
                        updated_at = NOW();
                `;
                await client.query(upsertQuery, [
                    data.uai || schoolId,
                    data.name,
                    data.address,
                    data.city,
                    data.postalCode,
                    data.phone || '',
                    data.adminEmail || data.email,
                    data.status
                ]);
            } finally {
                client.release();
            }
        } catch (pgError) {
            console.error("[Initialize School] PG Sync Error (Non-blocking):", pgError);
        }

        console.log(`[Initialize School] Success for ${schoolId}`);
        return { success: true };
    } catch (error: any) {
        console.error("[Initialize School] Error:", error);
        return { success: false, error: error.message };
    }
}

export async function sendWelcomeEmail(schoolId: string, email: string, schoolName: string) {
    try {
        console.log(`[Welcome Email] Starting process for ${schoolName} (${email})`);

        // 1. Generate Temporary Password
        const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);

        // 2. Create or Update User in Firebase Auth
        let userRecord;
        try {
            userRecord = await adminAuth.getUserByEmail(email);
            // Update existing user
            await adminAuth.updateUser(userRecord.uid, {
                password: tempPassword,
                displayName: schoolName,
            });
            console.log(`[Welcome Email] Updated existing user: ${userRecord.uid}`);
        } catch (error: any) {
            if (error.code === 'auth/user-not-found') {
                // Create new user
                userRecord = await adminAuth.createUser({
                    email: email,
                    password: tempPassword,
                    displayName: schoolName,
                    emailVerified: true // Assume verified since we are inviting them
                });
                console.log(`[Welcome Email] Created new user: ${userRecord.uid}`);
            } else {
                throw error;
            }
        }

        // 3. Set Custom Claims (School Admin Role)
        await adminAuth.setCustomUserClaims(userRecord.uid, {
            role: 'school_admin',
            schoolId: schoolId,
            schoolName: schoolName
        });

        // 4. Send Email
        const subject = "Bienvenue sur Pledgeum - Vos identifiants de connexion";
        const message = `
Bonjour,

L'établissement "${schoolName}" a été autorisé sur la plateforme Pledgeum.

Voici vos identifiants pour vous connecter et finaliser la configuration de votre établissement :

Lien : https://pledgeum.fr/login
Email : ${email}
Mot de passe provisoire : ${tempPassword}

Veuillez changer ce mot de passe dès votre première connexion.

Cordialement,
L'équipe Pledgeum
        `;

        const emailSent = await sendEmail({ to: email, subject, text: message });

        if (!emailSent.success) {
            throw new Error(`Failed to send email via notification service: ${emailSent.error}`);
        }

        return { success: true };
    } catch (error: any) {
        console.error("[Welcome Email] Error:", error);
        return { success: false, error: error.message };
    }
}

export async function forceSandboxUserRole(email: string) {
    try {
        console.log(`[Sandbox Role] Forcing role for ${email}`);

        let user;
        try {
            user = await adminAuth.getUserByEmail(email);
        } catch (e: any) {
            if (e.code === 'auth/user-not-found') {
                user = await adminAuth.createUser({
                    email,
                    emailVerified: true,
                    displayName: "Admin Sandbox"
                });
            } else throw e;
        }

        const schoolId = "9999999Z";
        const schoolName = "Lycée de Démonstration (Sandbox)";

        // 1. Set Auth Claims - Explicitly School Admin for this school only
        await adminAuth.setCustomUserClaims(user.uid, {
            role: 'school_admin',
            schoolId: schoolId,
            schoolName: schoolName
            // No 'super_admin' claim
        });

        // 2. Overwrite Firestore Profile (The Source of Truth for App Logic)
        // We use merge: true to keep system fields, but we overwrite all app logic fields
        // 2. Overwrite Firestore Profile (The Source of Truth for App Logic)
        // We use merge: true to keep system fields, but we overwrite all app logic fields
        await adminFirestore.collection('users').doc(user.uid).set({
            name: "Fabrice Dumasdelage",
            email: email,
            role: 'school_head',
            schoolId: '9999999Z', // Strict casing matching establishment ID
            status: 'active', // Explicit active status
            profileData: {
                firstName: "Fabrice",
                lastName: "Dumasdelage",
                email: email,
                phone: "0102030405",
                address: "12 Rue Ampère, 76500 Elbeuf", // As requested
                ecole_nom: schoolName,
                ecole_ville: "Elbeuf",
                role: "Proviseur",
                function: "Proviseur"
            },
            hasAcceptedTos: true,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        console.log(`[Sandbox Role] Success for ${user.uid} - Appointed Head of ${schoolName}`);
        return { success: true };
    } catch (error: any) {
        console.error("[Sandbox Role] Error:", error);
        return { success: false, error: error.message };
    }
}

export async function removeSchoolAccess(schoolId: string) {
    try {
        console.log(`[Remove School] Deleting school ID: ${schoolId}`);
        await adminFirestore.collection('schools').doc(schoolId).delete();
        console.log(`[Remove School] Success for ${schoolId}`);
        return { success: true };
    } catch (error: any) {
        console.error("[Remove School] Error:", error);
        return { success: false, error: error.message };
    }
}
