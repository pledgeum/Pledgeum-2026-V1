import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import pool from '@/lib/pg';

export async function POST(req: Request) {
    try {
        const { email, token, newPassword } = await req.json();

        if (!email || !token || !newPassword) {
            return NextResponse.json({ error: 'Tous les champs sont requis.' }, { status: 400 });
        }

        // 1. Verify Token
        const result = await pool.query(
            'SELECT * FROM verification_tokens WHERE identifier = $1 AND token = $2',
            [email, token]
        );

        if (result.rowCount === 0) {
            return NextResponse.json({ error: 'Token invalide ou inexistant.' }, { status: 400 });
        }

        const tokenData = result.rows[0];

        // Check Expiry
        if (new Date(tokenData.expires) < new Date()) {
            // Delete expired token
            await pool.query('DELETE FROM verification_tokens WHERE identifier = $1 AND token = $2', [email, token]);
            return NextResponse.json({ error: 'Le lien a expiré. Veuillez refaire une demande.' }, { status: 400 });
        }

        // 2. Hash Password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // 3. Update User
        // Note: Assuming 'password_hash' column name based on common patterns, but user request mentioned it. Verification needed? 
        // User request said: "Update User: UPDATE users SET password_hash = ... WHERE email = ....". If wrong column name, implementation fails.
        // Let's assume user knows their schema or I'll check schema later if it fails.
        // Also checking if user exists first is technically redundant if token exists (as token was created for existing user), 
        // but robust.

        await pool.query(
            'UPDATE users SET password_hash = $1 WHERE email = $2',
            [hashedPassword, email]
        );

        // 4. Cleanup Token
        await pool.query('DELETE FROM verification_tokens WHERE identifier = $1', [email]);

        return NextResponse.json({ message: 'Mot de passe mis à jour avec succès.' });

    } catch (error) {
        console.error('Reset Password Error:', error);
        return NextResponse.json({ error: 'Une erreur interne est survenue.' }, { status: 500 });
    }
}
