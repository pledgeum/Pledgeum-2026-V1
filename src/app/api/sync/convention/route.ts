import { NextResponse } from 'next/server';
import pool from '@/lib/pg';

export async function POST(req: Request) {
    if (!pool) {
        return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
    }

    try {
        const body = await req.json();
        const { id, studentId, userId, ...rest } = body;

        console.log(`[PG_SYNC] Received payload for ID: ${id}, Student: ${studentId}, User: ${userId}`);

        // Critical: User FK
        // Critical: User FK
        const studentUid = studentId || userId; // Fallback

        if (!studentUid) {
            console.error("[PG_SYNC] Error: Missing studentUid (userId or studentId required)");
            return NextResponse.json({ success: false, error: "Missing studentUid" }, { status: 400 });
        }

        const rawSiret = body.ent_siret;
        const companySiret = rawSiret ? rawSiret.replace(/\D/g, '').substring(0, 14) : null;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Upsert Company (Source of Truth)
            if (companySiret && companySiret.length === 14) {
                await client.query(`
                    INSERT INTO companies (siret, name, address, postal_code, city, phone)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (siret) DO UPDATE 
                    SET name = EXCLUDED.name, address = EXCLUDED.address, postal_code = EXCLUDED.postal_code, city = EXCLUDED.city
                 `, [
                    companySiret,
                    body.ent_nom || 'Entreprise Inconnue',
                    (body.ent_adresse || '') + (body.ent_code_postal ? ', ' + body.ent_code_postal : '') + (body.ent_ville ? ' ' + body.ent_ville : ''),
                    body.ent_code_postal,
                    body.ent_ville,
                    body.tuteur_tel // Phone logic might differ but let's take tutor phone or null
                ]);
            }

            // 2. Ensure User Exists (Stub)
            if (studentUid) {
                // Ensure email is not undefined
                const studentEmail = body.eleve_email || `missing_${studentUid}@pledgeum.fr`;
                await client.query(`
                    INSERT INTO users (uid, email, role)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (uid) DO NOTHING
                `, [studentUid, studentEmail, 'student']);
            }

            // 2b. Fetch Student UAI (Authority) - FIX for Cross-Tenant Leak
            // We must rely on the stored User Profile UAI, not the client-provided schoolId
            let resolvedUai = body.schoolId || null;
            if (studentUid) {
                const uRes = await client.query('SELECT establishment_uai FROM users WHERE uid = $1', [studentUid]);
                if (uRes.rows.length > 0 && uRes.rows[0].establishment_uai) {
                    resolvedUai = uRes.rows[0].establishment_uai;
                } else {
                    console.warn(`[PG_SYNC] Warning: Student ${studentUid} has no establishment_uai in DB. Using fallback: ${resolvedUai}`);
                }
            }

            // 3. Upsert Convention (V2 Schema)
            await client.query(`
                INSERT INTO conventions (
                    id, student_uid, establishment_uai, class_id, company_siret,
                    status, date_start, date_end, duration_hours,
                    tutor_email, tutor_name,
                    metadata, updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
                ON CONFLICT (id) DO UPDATE 
                SET 
                    student_uid = EXCLUDED.student_uid,
                    status = EXCLUDED.status,
                    company_siret = EXCLUDED.company_siret,
                    date_start = EXCLUDED.date_start,
                    date_end = EXCLUDED.date_end,
                    duration_hours = EXCLUDED.duration_hours,
                    tutor_email = EXCLUDED.tutor_email,
                    metadata = EXCLUDED.metadata,
                    updated_at = NOW()
            `, [
                id,
                studentUid,
                resolvedUai || null, // Allow null if really unknown, but should be prevented
                null, // class_id (Not mapped yet)
                (companySiret && companySiret.length === 14) ? companySiret : null,

                rest.status || 'DRAFT',
                rest.stage_date_debut || null,
                rest.stage_date_fin || null,
                parseInt(rest.stage_duree_heures) || 0,

                body.tuteur_email,
                (body.tuteur_prenom ? body.tuteur_prenom + ' ' : '') + (body.tuteur_nom || ''),

                JSON.stringify(body) // Metadata
            ]);

            await client.query('COMMIT');
            console.log(`[PG_SYNC] Convention saved successfully: ${id}`);
            return NextResponse.json({ success: true });


        } catch (dbErr: any) {
            await client.query('ROLLBACK');
            console.error("[PG_SYNC] TX Error:", dbErr);
            return NextResponse.json({ success: false, error: dbErr.message, stack: dbErr.stack }, { status: 500 });
        } finally {
            client.release();
        }

    } catch (error: any) {
        console.error("[PG_SYNC] Handler Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
