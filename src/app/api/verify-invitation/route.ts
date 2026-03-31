import { NextResponse } from 'next/server';
import pool from '@/lib/pg';
import { checkRateLimit, validateOrigin } from '@/lib/server-security';

export async function POST(request: Request) {
    let client;
    try {
        // 1. Security Checks
        if (!validateOrigin(request)) {
            return NextResponse.json({ error: "Forbidden Origin" }, { status: 403 });
        }

        const isAllowed = await checkRateLimit(request, 'otp-verify');
        if (!isAllowed) {
            return NextResponse.json({ error: "Trop de tentatives. Veuillez patienter." }, { status: 429 });
        }

        const body = await request.json();
        const { tempId: identifier, tempCode } = body;

        if (!identifier || !tempCode) {
            return NextResponse.json({ error: "Identifiants manquants" }, { status: 400 });
        }

        // 2. Query Postgres for Invitation/User
        client = await pool.connect();

        // We look for a user with this email OR temp_id
        // This resolves the ambiguity for staff (email) and students (temp_id)
        const res = await client.query(`
            SELECT email, first_name, last_name, role, establishment_uai, birth_date, class_id, temp_code
            FROM users
            WHERE (lower(email) = lower($1) OR upper(temp_id) = upper($1))
            LIMIT 1
        `, [identifier]);

        if (res.rowCount === 0) {
            return NextResponse.json({ error: "Identifiant non reconnu" }, { status: 404 });
        }

        const user = res.rows[0];

        // 3. Verify Code
        if (user.temp_code !== tempCode) {
            return NextResponse.json({ error: "Code d'accès incorrect" }, { status: 401 });
        }

        // 4. Return Data for Account Creation
        // Helper to format name
        const displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim();

        return NextResponse.json({
            success: true,
            user: {
                email: user.email,
                name: displayName,
                role: user.role,
                schoolId: user.establishment_uai,
                birthDate: user.birth_date,
                classId: user.class_id,
                // className is not easily available without a join, but frontend might not strictly need it for display if it has classId?
                // Or we can simple omit it or do a join. Let's do a join to be nice.
            }
        });

    } catch (error: any) {
        console.error('Invitation Verify Error:', error);
        return NextResponse.json(
            { error: 'Erreur technique lors de la vérification' },
            { status: 500 }
        );
    } finally {
        if (client) client.release();
    }
}
