
import { NextResponse } from 'next/server';
import pool from '@/lib/pg';
import { adminAuth, adminDb as db } from '@/lib/firebase-admin';

// PUT: Update Class (Assign Main Teacher)
export async function PUT(req: Request) {
    let client: any;
    try {
        const body = await req.json();
        const { classId, mainTeacherId, cpeId, pfmpPeriods, uai } = body; // classId is the Firestore ID (simple class ID)

        if (!classId || !uai) {
            return NextResponse.json({ error: "Missing classId or uai" }, { status: 400 });
        }

        client = await pool.connect();

        // ---------------------------------------------------------
        // TRANSACTION START: Ensure Atomicity for Teacher assignment
        // ---------------------------------------------------------
        await client.query('BEGIN'); // Start Transaction

        // 1. Resolve Class ID (Handle Legacy vs UUID)
        let pgClassId = classId;

        // Find existing class to resolve ID
        let classCheck = await client.query('SELECT id FROM classes WHERE id = $1', [classId]);
        if (classCheck.rowCount === 0) {
            // Try Legacy Composite
            const legacyId = `${classId}_${uai}`;
            classCheck = await client.query('SELECT id FROM classes WHERE id = $1', [legacyId]);
            if (classCheck.rowCount > 0) pgClassId = legacyId;
            else throw new Error(`Class not found: ${classId}`);
        } else {
            pgClassId = classCheck.rows[0].id;
        }

        // 2. Handle Main Teacher Update (Transactional)
        if (mainTeacherId !== undefined) {
            // A. Reset existing 'is_main_teacher' flags for this class
            await client.query(`
                UPDATE teacher_assignments 
                SET is_main_teacher = false, updated_at = NOW()
                WHERE class_id = $1
            `, [pgClassId]);

            // B. If a teacher is selected, set/insert Assignment as Main
            if (mainTeacherId) {
                // Upsert logic: Update if exists, Insert if not
                const toggleRes = await client.query(`
                    UPDATE teacher_assignments
                    SET is_main_teacher = true, updated_at = NOW()
                    WHERE class_id = $1 AND teacher_uid = $2
                    RETURNING id
                `, [pgClassId, mainTeacherId]);

                if (toggleRes.rowCount === 0) {
                    // Start fresh assignment
                    await client.query(`
                        INSERT INTO teacher_assignments (class_id, teacher_uid, is_main_teacher, created_at, updated_at)
                        VALUES ($1, $2, true, NOW(), NOW())
                    `, [pgClassId, mainTeacherId]);
                }
            }
        }

        // 3. Update Class Table (Redundant but required for Schema)
        // 3. Update Class Table (Redundant but required for Schema)
        // We use COALESCE for cpe_id to allow partial updates if desired, but main_teacher_id is explicit.
        // Actually, for strict sync, if mainTeacherId is undefined, we shouldn't touch it?
        // But the previous step (assignments) logic ran if mainTeacherId !== undefined.
        // Let's align: matching the params.

        const updateClassRes = await client.query(`
            UPDATE classes 
            SET 
                main_teacher_id = CASE WHEN $1::text IS NOT NULL OR $4 = true THEN $1 ELSE main_teacher_id END,
                cpe_id = CASE WHEN $2::text IS NOT NULL OR $5 = true THEN $2 ELSE cpe_id END,
                pfmp_periods = CASE WHEN $3::jsonb IS NOT NULL THEN $3 ELSE pfmp_periods END,
                updated_at = NOW()
            WHERE id = $6
            RETURNING id
        `, [
            mainTeacherId !== undefined ? (mainTeacherId || null) : null,
            cpeId !== undefined ? (cpeId || null) : null,
            pfmpPeriods !== undefined ? JSON.stringify(pfmpPeriods) : null,
            mainTeacherId === null, // Flag to allow setting to null if explicitly provided
            cpeId === null,         // Flag to allow setting to null if explicitly provided
            pgClassId
        ]);

        // 4. Fetch Details for Response
        let teacherDetails = null;
        if (mainTeacherId) {
            const tRes = await client.query('SELECT first_name, last_name, email FROM users WHERE uid = $1', [mainTeacherId]);
            if (tRes.rows.length) teacherDetails = tRes.rows[0];
        }

        // COMMIT TRANSACTION
        await client.query('COMMIT');

        // ... Firestore Sync (DISABLED: Migration to Postgres Complete) ...
        /*
        const year = "2025-2026";
        const classRef = db.doc(`establishments/${uai}/years/${year}/classes/${classId}`);

        await classRef.set({
            ...(mainTeacherId !== undefined && { mainTeacherId: mainTeacherId || null, mainTeacher: teacherDetails || null }),
            ...(cpeId !== undefined && { cpeId: cpeId || null }),
            updatedAt: new Date().toISOString()
        }, { merge: true });
        */

        return NextResponse.json({ success: true, mainTeacher: teacherDetails });

    } catch (error: any) {
        if (client) await client.query('ROLLBACK');
        console.error("[API] Update Class Transaction Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
        if (client) client.release();
    }
}

// GET: Fetch Classes with Enriched Main Teacher
export async function GET(req: Request) {
    let client: any;
    try {
        const { searchParams } = new URL(req.url);
        const uai = searchParams.get('uai');

        if (!uai) return NextResponse.json({ error: "UAI required" }, { status: 400 });

        client = await pool.connect();

        // Fetch Classes joined with Main Teacher AND Student Count
        const query = `
            SELECT 
                c.id as pg_id,
                c.name,
                c.main_teacher_id,
                u.first_name as teacher_first,
                u.last_name as teacher_last,
                -- FIX: If email is a Ghost ID, try to find the real account's email
                COALESCE(
                    (CASE 
                        WHEN u.email LIKE 'teacher-%' OR u.email LIKE '%@pledgeum.temp' THEN (
                            SELECT real_u.email 
                            FROM users real_u 
                            WHERE real_u.first_name = u.first_name 
                              AND real_u.last_name = u.last_name 
                              AND real_u.role = 'teacher' 
                              AND real_u.email NOT LIKE 'teacher-%' 
                              AND real_u.email NOT LIKE '%@pledgeum.temp'
                            LIMIT 1
                        )
                        ELSE u.email 
                    END),
                    u.email
                ) as teacher_email,
                c.cpe_id,
                u_cpe.first_name as cpe_first,
                u_cpe.last_name as cpe_last,
                u_cpe.email as cpe_email,
                c.pfmp_periods,
                (SELECT COUNT(*) FROM users s WHERE s.class_id = c.id AND s.role = 'student') as student_count,
                (SELECT COUNT(DISTINCT teacher_uid) FROM teacher_assignments ta WHERE ta.class_id = c.id) as teacher_count
            FROM classes c
            LEFT JOIN users u ON c.main_teacher_id = u.uid::text
            LEFT JOIN users u_cpe ON c.cpe_id = u_cpe.uid::text
            WHERE c.establishment_uai = $1
        `;

        console.log("[API] Executing Class Query:", query, "Params:", [uai]);
        const res = await client.query(query, [uai]);

        const classes = res.rows.map((row: any) => {
            // STRICT LOGIC: Always return the full DB ID.
            // The students are linked to the FULL ID. Stripping it breaks the link.
            const simpleId = row.pg_id;

            return {
                id: simpleId,
                name: row.name,
                studentCount: parseInt(row.student_count || '0', 10),
                teacherCount: parseInt(row.teacher_count || '0', 10), // Map teacherCount
                mainTeacher: row.main_teacher_id ? {
                    id: row.main_teacher_id,
                    firstName: row.teacher_first,
                    lastName: row.teacher_last,
                    email: row.teacher_email
                } : null,
                cpe: row.cpe_id ? {
                    id: row.cpe_id,
                    firstName: row.cpe_first,
                    lastName: row.cpe_last,
                    email: row.cpe_email
                } : null,
                pfmpPeriods: row.pfmp_periods || []
            };
        });

        return NextResponse.json({ classes });

    } catch (error: any) {
        console.error("[API] GET Classes Error:", error);
        return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
    } finally {
        if (client) client.release();
    }
}
