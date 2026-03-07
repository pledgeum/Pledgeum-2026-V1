import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import pool from '@/lib/pg';
import { z } from 'zod';

const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().min(1),
    role: z.string().optional(),
    profileData: z.record(z.string(), z.any()).optional(),
    birthDate: z.string().optional(),
});

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { email, password, name, role, profileData, birthDate } = registerSchema.parse(body);

        const normalizedEmail = email.toLowerCase().trim();

        // Check if user already exists
        const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
        if (existingUser.rows.length > 0) {
            return NextResponse.json({ error: 'Cet email est déjà utilisé.' }, { status: 409 });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Insert user
        // We assume 'users' table has columns matching logic.
        // If role/name/etc are columns.
        // Based on auth.ts: first_name, last_name, role.
        const [firstName, ...lastNameParts] = name.split(' ');
        const lastName = lastNameParts.join(' ');

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const insertUserText = `
                INSERT INTO users (email, password_hash, role, first_name, last_name, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
                RETURNING id, email, role, uid
            `;

            let newUser;

            // 1. Check for Ghost Account Claim (Critical for Teachers)
            const { tempCode, tempId } = body; // Unsafe extract, handled by if-check
            if (tempId && tempCode) {
                console.log(`[REGISTER] Attempting to claim ghost account for TempID: ${tempId}`);

                // Find match
                const ghostRes = await client.query(`
                    SELECT uid FROM users 
                    WHERE TRIM(UPPER(temp_id)) = TRIM(UPPER($1)) 
                      AND temp_code = $2
                `, [tempId, tempCode]);

                if ((ghostRes.rowCount ?? 0) > 0) {
                    const ghostUid = ghostRes.rows[0].uid;
                    console.log(`[REGISTER] MATCHE FOUND: Ghost UID ${ghostUid}. Updating to Real Account.`);

                    // Perform UPDATE (Claim)
                    const updateRes = await client.query(`
                        UPDATE users 
                        SET email = $1,
                            password_hash = $2,
                            first_name = $3,
                            last_name = $4,
                            email_verified = NOW(),
                            temp_id = NULL,
                            temp_code = NULL,
                            is_active = TRUE,
                            updated_at = NOW()
                        WHERE uid = $5
                        RETURNING id, email, role, uid
                    `, [normalizedEmail, hashedPassword, firstName, lastName, ghostUid]);

                    newUser = updateRes.rows[0];
                } else {
                    console.warn(`[REGISTER] TempID provided but NO MATCH found. Proceeding with FRESH INSERT.`);
                }
            }

            // 2. Fallback: Fresh Insert if not claimed
            if (!newUser) {
                const res = await client.query(insertUserText, [normalizedEmail, hashedPassword, role || 'student', firstName, lastName]);
                newUser = res.rows[0];
            }

            await client.query('COMMIT');

            return NextResponse.json({ user: newUser });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

    } catch (error: any) {
        console.error('Registration error:', error);
        return NextResponse.json({ error: error.message || 'Erreur lors de l\'inscription' }, { status: 500 });
    }
}
