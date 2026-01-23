'use server';

import { verifyMagicLink, markMagicLinkAsUsed } from '@/services/magicLinkService';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { generateVerificationUrl } from '@/app/actions/sign'; // Reuse to redirect to signature
import { Convention } from '@/store/convention'; // Type definition

export async function submitOnboarding(token: string, formData: FormData) {
    const password = formData.get('password') as string;
    const phone = formData.get('phone') as string;
    const name = formData.get('name') as string;

    // 1. Verify Token
    const payload = await verifyMagicLink(token);
    if (!payload) {
        return { error: "Lien invalide ou expiré." };
    }

    const { email, role, conventionId } = payload;

    try {
        let uid;
        let isNewUser = false;

        // 2. Check/Create Auth User
        try {
            const existingUser = await adminAuth.getUserByEmail(email);
            uid = existingUser.uid;
            // If they exist, we just update their profile if needed or log them in (client side will handle auth via token?)
            // Actually, we can't log them in via Server Action directly without a custom token.
            // But if they have an account, they should just login.
            // This form is for CREATION (Setting password).
            // If user exists, we probably shouldn't set password here unless it's a reset?
            // "Activation" implies creation.
            // Ensure we don't overwrite password for existing active users.
            return { error: "Un compte existe déjà pour cet email. Veuillez vous connecter." };

        } catch (e: any) {
            if (e.code === 'auth/user-not-found') {
                // Create User
                const newUser = await adminAuth.createUser({
                    email,
                    password,
                    displayName: name,
                    emailVerified: true // Trust the magic link email
                });
                uid = newUser.uid;
                isNewUser = true;
            } else {
                throw e;
            }
        }

        if (isNewUser && uid) {
            // 3. Create Firestore User Document
            // Retrieve Convention for Company Info context
            const convSnap = await adminDb.collection('conventions').doc(conventionId).get();
            const conventionData = convSnap.data() as any;

            await adminDb.collection('users').doc(uid).set({
                uid,
                email,
                role: 'tutor', // Force role from invite
                uai: conventionData?.schoolId || '', // Link to school? Or keep loose?
                createdAt: new Date().toISOString(),
                hasAcceptedTos: true, // Implicit acceptance via form?
                profileData: {
                    firstName: name.split(' ')[0],
                    lastName: name.split(' ').slice(1).join(' ') || '',
                    phone: phone,
                    function: 'Tuteur',
                    companyName: conventionData?.ent_nom,
                    companySiret: conventionData?.ent_siret,
                    companyAddress: conventionData?.ent_adresse
                },
                legalRepresentatives: []
            });
        }

        // 4. Mark Token Used
        await markMagicLinkAsUsed(token);

        // 5. Generate Custom Token for Immediate Login on Client
        const customToken = await adminAuth.createCustomToken(uid);

        // 6. Provide Redirect URL (Targeting the Signature Page)
        // We need to construct the /verify URL.
        // We can fetch the convention to generate the signed URL params correctly.
        const convSnap = await adminDb.collection('conventions').doc(conventionId).get();
        if (!convSnap.exists) return { error: "Convention introuvable" };

        const convention = { id: conventionId, ...convSnap.data() } as Convention;

        // Generate the signature URL
        const sigResult = await generateVerificationUrl(convention, 'convention');
        // Note: generateVerificationUrl returns a absolute URL or relative.
        // We want the relative path usually to redirect via Next.js
        const redirectPath = sigResult.url.replace(process.env.NEXT_PUBLIC_APP_URL || '', '');

        return { success: true, customToken, redirectPath, isNewUser };

    } catch (error: any) {
        console.error("Onboarding Error:", error);
        return { error: "Erreur technique : " + error.message };
    }
}
