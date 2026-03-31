import { NextResponse } from 'next/server';
import pool from '@/lib/pg';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
    let client;
    try {
        const body = await request.json();
        const { email, token, password } = body;

        console.log("👉 Collaborator Activation API Hit:", { email });

        if (!email || !token || !password) {
            return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
        }

        client = await pool.connect();

        // 1. Verify Token from verification_tokens table
        // We ensure the token matches the identifier (email) and is not expired
        const tokenRes = await client.query(`
            SELECT identifier, token, expires
            FROM verification_tokens
            WHERE identifier = $1 AND token = $2
            LIMIT 1
        `, [email, token]);

        if (tokenRes.rowCount === 0) {
            return NextResponse.json({ error: "Lien d'activation invalide ou expiré." }, { status: 401 });
        }

        const tokenData = tokenRes.rows[0];
        if (new Date() > new Date(tokenData.expires)) {
            return NextResponse.json({ error: "Ce lien d'activation a expiré." }, { status: 401 });
        }

        // 2. Identify User
        const userRes = await client.query(`
            SELECT uid, is_active FROM users WHERE email = $1 LIMIT 1
        `, [email]);

        if (userRes.rowCount === 0) {
            return NextResponse.json({ error: "Utilisateur non trouvé." }, { status: 404 });
        }

        const user = userRes.rows[0];

        // 3. Update User: Set password, activate, clear temporary flags
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        await client.query('BEGIN');

        try {
            // Update user
            await client.query(`
                UPDATE users 
                SET password_hash = $1, 
                    email_verified = NOW(),
                    is_active = TRUE,
                    must_change_password = FALSE,
                    updated_at = NOW()
                WHERE uid = $2
            `, [passwordHash, user.uid]);

            // 4. Delete the used token
            await client.query(`
                DELETE FROM verification_tokens 
                WHERE identifier = $1 AND token = $2
            `, [email, token]);

            await client.query('COMMIT');

            return NextResponse.json({ 
                success: true, 
                message: "Compte activé avec succès." 
            });

        } catch (dbError) {
            await client.query('ROLLBACK');
            throw dbError;
        }

    } catch (error: any) {
        console.error("Collaborator Activation Error:", error);
        return NextResponse.json({ error: "Erreur serveur lors de l'activation." }, { status: 500 });
    } finally {
        if (client) client.release();
    }
}
