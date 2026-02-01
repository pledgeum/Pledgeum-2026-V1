import { NextResponse } from 'next/server';
import pool from '@/lib/pg';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
    let client;
    try {
        const body = await request.json();
        const { tempId, tempCode, email, password } = body;

        console.log("👉 Activation Request:", { tempId, newEmail: email, hasPassword: !!password });

        if (!tempId || !email || !password) {
            return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
        }

        const cleanTempId = tempId.trim();

        client = await pool.connect();

        // ---------------------------------------------------------
        // DIAGNOSTIC MODE (FORENSIC DUMP)
        // ---------------------------------------------------------
        try {
            console.log("🔍 STARTING FORENSIC DUMP 🔍");

            // 1. List Tables
            const tablesRes = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
            console.log("📊 Tables:", tablesRes.rows.map(r => r.table_name));

            // 2. Dump First 5 Users
            const usersDump = await client.query('SELECT * FROM users LIMIT 5');
            console.log("👤 Users Sample:", usersDump.rows);

            console.log("🔍 END FORENSIC DUMP 🔍");

        } catch (dbgErr) {
            console.warn("Forensic dump failed", dbgErr);
        }

        // DEBUG: Peek at the database content (to see real format)
        try {
            const debugCheck = await client.query('SELECT uid, temp_id, email FROM users WHERE temp_id IS NOT NULL LIMIT 3');
            console.log('👀 DB Sample (temp_ids):', debugCheck.rows);
        } catch (dbgErr) {
            console.warn("Debug query failed", dbgErr);
        }

        // ---------------------------------------------------------
        // 1. LOOKUP: Find User by TempID (Strict but Robust)
        // ---------------------------------------------------------
        // We use TRIM + UPPER to handle copy-paste spaces or case differences
        const userRes = await client.query(`
            SELECT uid, temp_code, temp_id, email, is_active 
            FROM users 
            WHERE TRIM(UPPER(temp_id)) = TRIM(UPPER($1))
            LIMIT 1
        `, [cleanTempId]);

        if (userRes.rowCount === 0) {
            console.error(`❌ Activate: TempID '${cleanTempId}' not found.`);
            // Double check strict match failure
            return NextResponse.json({ error: "Code d'activation introuvable" }, { status: 404 });
        }

        const targetUser = userRes.rows[0];

        // ---------------------------------------------------------
        // 2. VERIFY: Check Code
        // ---------------------------------------------------------
        if (targetUser.temp_code !== tempCode) {
            console.error("❌ Activate: Invalid Code");
            return NextResponse.json({ error: "Code invalide" }, { status: 401 });
        }

        // ---------------------------------------------------------
        // 3. COLLISION CHECK: Is new email taken?
        // ---------------------------------------------------------
        // We are about to set this user's email to 'email'. Must ensure no other user has it.
        // It's okay if the user THEMSELVES has it (re-activation).
        const emailCheck = await client.query(`
            SELECT uid FROM users WHERE LOWER(email) = LOWER($1) AND uid != $2
        `, [email, targetUser.uid]);

        if (emailCheck.rowCount !== null && emailCheck.rowCount > 0) {
            console.error("❌ Activate: Email collision");
            return NextResponse.json({ error: "Cet email est déjà utilisé par un autre compte." }, { status: 409 });
        }

        // ---------------------------------------------------------
        // 4. UPDATE: Set Credentials & Email
        // ---------------------------------------------------------
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        await client.query('BEGIN');

        try {
            console.log(`🔄 Activating User ${targetUser.uid}. Setting email to ${email}`);
            await client.query(`
                UPDATE users 
                SET password_hash = $1, 
                    email = $2, 
                    email_verified = NOW(),
                    updated_at = NOW(),
                    temp_id = NULL,
                    temp_code = NULL,
                    is_active = TRUE
                WHERE uid = $3
             `, [passwordHash, email, targetUser.uid]);

            await client.query('COMMIT');
            console.log("✅ Activation Successful.");
            return NextResponse.json({ success: true });

        } catch (dbError) {
            await client.query('ROLLBACK');
            throw dbError;
        }

    } catch (error: any) {
        console.error("Activate Server Error:", error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    } finally {
        if (client) client.release();
    }
}
