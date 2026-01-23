import { NextResponse } from 'next/server';
import pool from '@/lib/pg';

export async function POST(request: Request) {
    if (!pool) {
        return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
    }

    try {
        const body = await request.json();
        const { uid, email, displayName, photoURL, source } = body;

        console.log(`[API_USERS] Received creation request for: ${email} (${uid})`);

        if (!uid || !email) {
            console.warn('[API_USERS] Missing required fields:', { uid, email });
            return NextResponse.json({ error: 'Missing required fields: uid or email' }, { status: 400 });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Determine Defaults
            let role = 'student'; // Security: Default to student
            let establishmentUai = null;
            let firstName = '';
            let lastName = '';
            let jobFunction = null;
            let phone = null;
            let addressStr = null;
            let photoUrl = photoURL || null;

            // Parse Display Name
            if (displayName) {
                const parts = displayName.split(' ');
                if (parts.length > 1) {
                    firstName = parts[0];
                    lastName = parts.slice(1).join(' ');
                } else {
                    firstName = displayName;
                }
            }

            // 2. Server-Side Sandbox Logic (Strict)
            // Hardcoded "Super Admin / Sandbox" access
            if (email === 'fabrice.dumasdelage@gmail.com' || email === 'pledgeum@gmail.com') {
                console.log(`[API_USERS] Applying Sandbox Admin Privileges for ${email}`);
                role = 'school_head';
                establishmentUai = '9999999X';
                firstName = firstName || 'Fabrice';
                lastName = lastName || 'Dumasdelage';
                jobFunction = 'Proviseur';
                phone = '0600000000';
                addressStr = "12 Rue Ampère 76500 Elbeuf";
            }

            // 3. Upsert into Users Table
            // We use ON CONFLICT to ensure idempotency (Sync on login)
            // Columns: uid, email, role, establishment_uai, first_name, last_name, 
            // job_function, phone, address, photo_url, created_at, updated_at, has_accepted_tos

            const insertQuery = `
                INSERT INTO users (
                    uid, email, role, establishment_uai, first_name, last_name, 
                    job_function, phone, address, photo_url,
                    created_at, updated_at, has_accepted_tos
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW(), $11)
                ON CONFLICT (uid) 
                DO UPDATE SET 
                    last_connection_at = NOW(),
                    updated_at = NOW()
                RETURNING *;
            `;

            // Prepare safe values for query
            const safeFirstName = firstName || null;
            const safeLastName = lastName || null;
            const safeUai = establishmentUai || null;

            // Auto-accept TOS for Sandbox? No, better let them accept.
            const isSandboxUser = email === 'fabrice.dumasdelage@gmail.com';

            const checkRes = await client.query('SELECT uid FROM users WHERE uid = $1', [uid]);
            let user;

            if (checkRes.rowCount === 0) {
                // CREATE
                console.log(`[API_USERS] Creating new user record for ${uid}`);
                const res = await client.query(insertQuery, [
                    uid,
                    email,
                    role,
                    safeUai,
                    safeFirstName,
                    safeLastName,
                    jobFunction || null,
                    phone || null,
                    addressStr || null,
                    photoUrl || null,
                    isSandboxUser
                ]);
                user = res.rows[0];
            } else {
                // UPDATE (Touch)
                console.log(`[API_USERS] Updating existing user ${uid}`);
                // If Sandbox user, maybe force repair?
                if (email === 'fabrice.dumasdelage@gmail.com') {
                    // Force repair logic similar to store
                    await client.query(`
                        UPDATE users SET 
                            establishment_uai = '9999999X', 
                            role = 'school_head', 
                            job_function = 'Proviseur'
                        WHERE uid = $1
                     `, [uid]);
                }

                const updateQuery = `UPDATE users SET last_connection_at = NOW() WHERE uid = $1 RETURNING *`;
                const res = await client.query(updateQuery, [uid]);
                user = res.rows[0];
            }

            await client.query('COMMIT');

            return NextResponse.json({ success: true, user });

        } catch (error: any) {
            await client.query('ROLLBACK');
            console.error('[API_USERS] Creation Error Details:', {
                message: error.message,
                stack: error.stack,
                code: error.code
            });
            return NextResponse.json({ error: 'Failed to create user', details: error.message }, { status: 500 });
        } finally {
            client.release();
        }

    } catch (error: any) {
        console.error('[API_USERS] Request parsing error:', error);
        return NextResponse.json({ error: 'Invalid Request Body', details: error.message }, { status: 400 });
    }
}
