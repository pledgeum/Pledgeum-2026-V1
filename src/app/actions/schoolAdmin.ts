'use server';

import { adminAuth, adminFirestore } from '@/lib/firebase-admin';
import { sendNotification } from '@/lib/notification';

export async function initializeSchoolIdentity(schoolId: string, data: {
    name: string;
    address: string;
    city: string;
    postalCode: string;
    email: string;
    phone?: string;
}) {
    try {
        console.log(`[Initialize School] Starting for ${data.name} (${schoolId})`);

        await adminFirestore.collection('schools').doc(schoolId).set({
            schoolName: data.name,
            schoolAddress: data.address, // Full address string usually
            schoolCity: data.city,
            schoolPostalCode: data.postalCode,
            schoolHeadEmail: data.email, // Default head email to school email
            schoolPhone: data.phone || '', // Optional
            updatedAt: new Date().toISOString(),
            isAuthorized: true
        }, { merge: true });

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

        const emailSent = await sendNotification(email, subject, message);

        if (!emailSent) {
            throw new Error("Failed to send email via notification service");
        }

        return { success: true };
    } catch (error: any) {
        console.error("[Welcome Email] Error:", error);
        return { success: false, error: error.message };
    }
}
