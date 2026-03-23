'use server';

import { adminFirestore } from '@/lib/firebase-admin';
import { sendEmail } from '@/lib/email';
import pool from '@/lib/pg';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

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

        // Keep Firebase Mock for now to avoid breaking other calls, but it's mostly ghost code
        await adminFirestore.collection('schools').doc(schoolId).set({
            schoolName: data.name,
            schoolAddress: data.address,
            schoolCity: data.city,
            schoolPostalCode: data.postalCode,
            schoolHeadEmail: data.adminEmail || data.email,
            schoolPhone: data.phone || '',
            schoolUai: data.uai || schoolId,
            updatedAt: new Date().toISOString(),
            isAuthorized: true,
            schoolStatus: data.status
        }, { merge: true });

        // 2. Persist to PostgreSQL (Source of Truth)
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
        const tempPassword = Math.random().toString(36).slice(-10) + "1!Aa"; // Stronger temp password
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        // 2. Postgres Upsert (Source of Truth for NextAuth)
        const client = await pool.connect();
        try {
            const upsertQuery = `
                INSERT INTO users (uid, email, role, password_hash, must_change_password, last_name, establishment_uai, updated_at, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
                ON CONFLICT (email) DO UPDATE SET
                    password_hash = EXCLUDED.password_hash,
                    must_change_password = EXCLUDED.must_change_password,
                    role = EXCLUDED.role,
                    establishment_uai = EXCLUDED.establishment_uai,
                    updated_at = NOW()
                RETURNING uid;
            `;
            const result = await client.query(upsertQuery, [
                crypto.randomUUID(),
                email.toLowerCase().trim(),
                'school_head', // Or 'school_admin', standardizing on school_head for the main contact
                hashedPassword,
                true, // must_change_password exists as confirmed by audit
                schoolName,
                schoolId
            ]);
            
            console.log(`[Welcome Email] User synced in Postgres: ${result.rows[0].uid}`);
        } finally {
            client.release();
        }

        // 4. Send Email
        const subject = "Bienvenue sur Pledgeum - Vos identifiants de connexion";
        const message = `Madame, Monsieur le chef d'établissement,

Nous vous souhaitons la bienvenue sur la plateforme Pledgeum qui vous permettra d'optimiser la gestion des stages en milieu professionnel de vos élèves et étudiants ainsi que de suivre leurs parcours à la sortie de votre établissement.

Vous trouverez ci-après vos identifiants afin de vous connecter et finaliser la configuration de celui-ci : "${schoolName}" :

Lien : https://www.pledgeum.fr/
Email : ${email}
Mot de passe provisoire : ${tempPassword}

Vous serez invité à changer ce mot de passe dès votre première connexion.

Cordialement,
L'équipe Pledgeum`;

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

        const schoolId = "9999999Z";
        const schoolName = "Lycée de Démonstration (Sandbox)";
        
        // 1. Generate Sandbox Access
        const tempPassword = "Sandbox-Password-2025!"; // Known for test but can be random
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        // 2. Overwrite Postgres Profile (Source of Truth for NextAuth)
        const client = await pool.connect();
        try {
            const upsertQuery = `
                INSERT INTO users (
                    uid, email, role, password_hash, must_change_password, 
                    first_name, last_name, phone, address, 
                    establishment_uai, updated_at, created_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
                ON CONFLICT (email) DO UPDATE SET
                    role = EXCLUDED.role,
                    password_hash = EXCLUDED.password_hash,
                    must_change_password = EXCLUDED.must_change_password,
                    first_name = EXCLUDED.first_name,
                    last_name = EXCLUDED.last_name,
                    establishment_uai = EXCLUDED.establishment_uai,
                    updated_at = NOW();
            `;
            await client.query(upsertQuery, [
                crypto.randomUUID(),
                email.toLowerCase().trim(),
                'school_head',
                hashedPassword,
                false, // Sandbox might not need forced re-change if we repair it
                "Fabrice",
                "Dumasdelage",
                "0102030405",
                "12 Rue Ampère, 76500 Elbeuf",
                schoolId
            ]);
        } finally {
            client.release();
        }

        console.log(`[Sandbox Role] Success for ${email} - Appointed Head of ${schoolName}`);
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
