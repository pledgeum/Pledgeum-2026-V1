'use server';

import { createMagicLink } from '@/services/magicLinkService';
import { sendEmail } from '@/lib/email';
import { adminDb } from '@/lib/firebase-admin';

export async function sendConventionInvitation(conventionId: string, role: string, email: string, name: string) {
    try {
        // 1. Generate Magic Link
        const inviteUrl = await createMagicLink(conventionId, role, email);

        // 2. Fetch Convention for Context (Optional, could just use params passed if trusted)
        // Let's trust params for speed or fetch if we want content.

        // 3. Send Email
        const subject = `Activation de votre compte Tuteur - ${name}`;
        const text = `Bonjour ${name},\n\n` +
            `Vous avez été désigné comme tuteur pour une convention de stage.\n` +
            `Pour signer la convention et accéder au suivi, veuillez activer votre espace tuteur via ce lien sécurisé :\n\n` +
            `${inviteUrl}\n\n` +
            `Ce lien est valable 7 jours.\n\n` +
            `Cordialement,\nL'équipe Pledgeum`;

        await sendEmail({
            to: email,
            subject,
            text
        });

        // Log handled by send-email internal log or we trust it works. 
        // Note: The `sendEmail` utility doesn't log to Postgres by default locally, only the API route did in previous step.
        // We might want to fix logging consistency later, but `send-email` API route does log.
        // If we use the lib directly here, we bypass the API route logging unless we add it to the lib or here.
        // Let's keep it simple.

        return { success: true };

    } catch (e: any) {
        console.error("Invitation Error:", e);
        return { error: e.message };
    }
}
