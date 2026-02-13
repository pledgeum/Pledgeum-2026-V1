
import { NextResponse } from 'next/server';
import { auth } from '@/auth'; // Adjust import based on project structure
import pool from '@/lib/pg';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session || !session.user || !session.user.id) {
            console.error('[API_PASSWORD_UPDATE] Unauthorized: Missing session or user ID');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { password } = body;

        // Validation
        if (!password || password.length < 8) {
            return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' }, { status: 400 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = session.user.id;
        const email = session.user.email;

        console.log(`[API_PASSWORD_UPDATE] Updating password for user: ${email} (${userId})`);

        // Update User
        await pool.query(
            `UPDATE users 
             SET password_hash = $1, must_change_password = false, updated_at = NOW() 
             WHERE uid = $2`,
            [hashedPassword, userId]
        );

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('[API_PASSWORD_UPDATE] Update Password Error:', error);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}
