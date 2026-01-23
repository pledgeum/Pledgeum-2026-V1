import { NextResponse } from 'next/server';
import pool from '@/lib/pg';

export async function POST(req: Request) {
    if (!pool) {
        return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
    }

    try {
        const body = await req.json();
        const { id, studentId, userId, ...rest } = body;

        // Critical: User FK
        const studentUid = userId || studentId; // Fallback
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
                await client.query(`
                    INSERT INTO users (uid, email, role)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (uid) DO NOTHING
                `, [studentUid, body.eleve_email || `missing_${studentUid}@pledgeum.fr`, 'student']);
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
                body.schoolId !== '9999999X' && body.schoolId ? body.schoolId : '9999999X',
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
            return NextResponse.json({ success: true });


        } catch (dbErr: any) {
            await client.query('ROLLBACK');
            console.error("[PG_SYNC] TX Error:", dbErr);
            throw dbErr;
        } finally {
            client.release();
        }

    } catch (error: any) {
        console.error("[PG_SYNC] Handler Error:", error);
        // User requested: "Application ne plante pas" -> Return 200 with error info?
        // Or just let store catch it. The store will catch non-200.
        // Let's return 200 with error field so store can log but not throw.
        return NextResponse.json({ success: false, error: error.message }, { status: 200 });
    }
}
