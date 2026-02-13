import { NextResponse } from 'next/server';
import crypto from 'crypto';
import pool from '@/lib/pg'; // Ensure this path is correct based on your file structure
import { sendEmail } from '@/lib/email';

export async function POST(req: Request) {
    try {
        const { email } = await req.json();

        if (!email) {
            return NextResponse.json({ error: 'Email requis' }, { status: 400 });
        }

        // 1. Check if user exists (to prevent enumeration attacks, we might want to *always* return success, 
        // but for UX in internal tools sometimes we want to know. Let's stick to secure default: return success even if not found, 
        // but existing logic might have different patterns. Let's check user existence first.)

        // Actually, let's just proceed. If user doesn't exist, we just don't send the email but return 200.
        const userResult = await pool.query('SELECT email FROM users WHERE email = $1', [email]);

        if (userResult.rowCount === 0) {
            // User not found. Return success to avoid enumeration.
            // Simulate delay to mask timing attacks? (Optional/Advanced)
            return NextResponse.json({ message: 'Si ce compte existe, un email a été envoyé.' });
        }

        // 2. Generate secure token
        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 3600 * 1000); // 1 hour from now

        // 3. Save to DB
        // We use ON CONFLICT to update the token if one already exists for this user? 
        // Or just insert new? The table has UNIQUE(identifier, token). 
        // Let's delete old tokens for this user first to keep it clean.
        await pool.query('DELETE FROM verification_tokens WHERE identifier = $1', [email]);

        await pool.query(
            'INSERT INTO verification_tokens (identifier, token, expires) VALUES ($1, $2, $3)',
            [email, token, expires]
        );

        // 4. Send Email
        const resetLink = `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${token}&email=${email}`;

        const emailResult = await sendEmail({
            to: email,
            subject: 'Réinitialisation de votre mot de passe',
            text: `Bonjour,\n\nVous avez demandé une réinitialisation de mot de passe. Veuillez cliquer sur le lien suivant pour créer un nouveau mot de passe :\n\n${resetLink}\n\nCe lien expirera dans 1 heure.\n\nSi vous n'êtes pas à l'origine de cette demande, veuillez ignorer cet email.\n\nCordialement,\nL'équipe Pledgeum`
        });

        if (!emailResult.success) {
            console.error('Failed to send email:', emailResult.error);
            return NextResponse.json({ error: 'Erreur lors de l\'envoi de l\'email.' }, { status: 500 });
        }

        return NextResponse.json({ message: 'Si ce compte existe, un email a été envoyé.' });

    } catch (error) {
        console.error('Forgot Password Error:', error);
        return NextResponse.json({ error: 'Une erreur interne est survenue.' }, { status: 500 });
    }
}
