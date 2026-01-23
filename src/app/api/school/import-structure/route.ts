import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import pool from '@/lib/pg';
import { z } from 'zod';
import crypto from 'crypto';

// Utility functions
function normalizeString(str: string) {
    if (!str) return '';
    return str.trim().toUpperCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function getTripletKey(last: string, first: string, dob: string) {
    return `${normalizeString(last)}|${normalizeString(first)}|${dob}`;
}

// Validation Schemas
const StudentSchema = z.object({
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().optional(),
    birthDate: z.string(),
    originalClass: z.string()
});

const ImportSchema = z.object({
    schoolId: z.string(),
    schoolYear: z.string().default('2025-2026'),
    classes: z.array(z.object({
        name: z.string(),
        students: z.array(StudentSchema)
    }))
});

export async function POST(req: Request) {
    let client;
    try {
        const body = await req.json();
        const { schoolId, schoolYear, classes } = ImportSchema.parse(body);

        if (!schoolId) return NextResponse.json({ error: "School ID required" }, { status: 400 });

        client = await pool.connect();

        const stats = {
            classesCreated: 0,
            classesFound: 0,
            studentsCreated: 0,
            studentsUpdated: 0,
            studentsArchived: 0,
            errors: 0
        };

        // ------------------------------------------------------------------
        // STEP 1: RESOLVE CLASSES (Get REAL IDs)
        // ------------------------------------------------------------------
        const classIdMap = new Map<string, string>(); // Name -> UUID

        const existingClassesResult = await client.query(
            'SELECT id, name FROM classes WHERE establishment_uai = $1',
            [schoolId]
        );

        const existingClassesMap = new Map<string, string>();
        existingClassesResult.rows.forEach((row: any) => {
            existingClassesMap.set(normalizeString(row.name), row.id);
            existingClassesMap.set(row.name, row.id);
        });

        for (const cls of classes) {
            try {
                const normName = normalizeString(cls.name);
                let realId = existingClassesMap.get(normName) || existingClassesMap.get(cls.name);

                if (realId) {
                    classIdMap.set(cls.name, realId);
                    stats.classesFound++;
                } else {
                    realId = crypto.randomUUID();
                    await client.query(`
                        INSERT INTO classes (id, name, establishment_uai, updated_at)
                        VALUES ($1, $2, $3, NOW())
                        ON CONFLICT (establishment_uai, name) DO NOTHING
                    `, [realId, cls.name, schoolId]);

                    const finalCheck = await client.query(
                        'SELECT id FROM classes WHERE establishment_uai = $1 AND name = $2',
                        [schoolId, cls.name]
                    );

                    if (finalCheck.rows.length > 0) {
                        realId = finalCheck.rows[0].id;
                        classIdMap.set(cls.name, realId!);
                        stats.classesCreated++;
                    } else {
                        throw new Error(`Failed to create or retrieve class ${cls.name}`);
                    }
                }
                console.log(`[DEBUG] Resolved Class '${cls.name}' -> ID: ${realId}`);
            } catch (e: any) {
                console.error(`Error resolving class ${cls.name}:`, e.message);
                stats.errors++;
            }
        }

        // ------------------------------------------------------------------
        // STEP 2: PREPARE ARCHIVAL DATA & BATCHES
        // ------------------------------------------------------------------
        const archivalQuery = await client.query(`
            SELECT uid FROM users 
            WHERE establishment_uai = $1 AND role = 'student' AND is_active = TRUE
        `, [schoolId]);

        const existingActiveUids = new Set<string>(archivalQuery.rows.map(r => r.uid));

        const studentsToInsert: any[] = [];
        const processedUIDs = new Set<string>();
        const seenTriplets = new Set<string>();
        const authTasks: Promise<any>[] = [];

        for (const cls of classes) {
            const realClassId = classIdMap.get(cls.name);
            if (!realClassId) continue;

            for (const student of cls.students) {
                let dob = student.birthDate;
                if (dob.includes('/')) {
                    const parts = dob.split('/');
                    if (parts.length === 3) dob = `${parts[2]}-${parts[1]}-${parts[0]}`;
                }

                const tripletKey = getTripletKey(student.lastName, student.firstName, dob);

                if (seenTriplets.has(tripletKey)) {
                    console.log(`[API] Skipping Duplicate in CSV: ${tripletKey}`);
                    continue;
                }
                seenTriplets.add(tripletKey);

                try {
                    // --- THE GUARD: Database Lookup ---
                    const lookupQuery = `
                        SELECT uid, email FROM users
                        WHERE unaccent(lower(last_name)) = unaccent(lower($1))
                          AND unaccent(lower(first_name)) = unaccent(lower($2))
                          AND birth_date = $3
                          AND role = 'student'
                          AND establishment_uai = $4
                        LIMIT 1
                    `;

                    const lookupRes = await client.query(lookupQuery, [
                        student.lastName,
                        student.firstName,
                        dob,
                        schoolId
                    ]);

                    let uid: string;
                    let finalEmail = student.email;

                    if (lookupRes.rows.length > 0) {
                        // FOUND
                        const existingUser = lookupRes.rows[0];
                        uid = existingUser.uid;
                        if (!finalEmail) finalEmail = existingUser.email;

                        // --- SELF-HEALING AUTH (LIVENESS CHECK) ---
                        try {
                            // Verify liveness
                            await adminAuth.getUser(uid);
                            // console.log(`[IMPORT] Link Valid for ${uid}`);
                        } catch (e: any) {
                            if (e.code === 'auth/user-not-found') {
                                // DEAD UID -> Repair
                                const newUid = `student-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                                console.log(`[IMPORT SELF-HEALING] Dead UID detected for ${student.firstName} ${student.lastName} (Old: ${uid}). Repairing...`);

                                // Create Auth
                                authTasks.push(
                                    adminAuth.createUser({
                                        uid: newUid,
                                        email: finalEmail || `${newUid}@missing.email`,
                                        displayName: `${student.firstName} ${student.lastName}`,
                                        password: 'InitialPassword123!'
                                    }).then(() => {
                                        return adminAuth.setCustomUserClaims(newUid, { role: 'student', schoolId });
                                    }).catch((err) => {
                                        console.error(`[REPAIR AUTH ERROR] Failed to create ${finalEmail}:`, err.message);
                                    })
                                );

                                // Update Postgres immediately (blocking or async? Better to push to batch?)
                                // We need correct UID for the batch insert logic later? 
                                // Actually, the batch insert logic below is for NEW/UPDATED rows. 
                                // If we found a user, we usually SKIP insert effectively?
                                // Wait, the current logic PUSHES to `studentsToInsert` regardless of whether found or not?
                                // Let's check logic below.

                                // Logic below: `studentsToInsert.push({ uid, ... })`
                                // Bulk Insert query is: `INSERT ... ON CONFLICT (...) DO UPDATE ...`
                                // So we CAN just change `uid` here to `newUid` and the bulk upsert *should* handle it?
                                // PROBLEM: `ON CONFLICT` is on (name, dob). It will UPDATE the row matching name/dob.
                                // But `uid` is usually the PK or unique? 
                                // If we pass `newUid` in the VALUES, but the row exists with `oldUid`.
                                // The `ON CONFLICT` target is `(name, dob)`.
                                // The `DO UPDATE` clause sets `class_id`, `is_active`, etc.
                                // DOES IT UPDATE UID?
                                // Looking at lines 235-240:
                                // `DO UPDATE SET class_id = ..., establishment_uai = ...`
                                // NO. It does NOT update UID.

                                // AUTO-CORRECTION: We must manually update UID here if we want to repair it.
                                await client.query('UPDATE users SET uid = $1 WHERE uid = $2', [newUid, uid]);
                                uid = newUid; // Update local var so `studentsToInsert` uses new UID if needed? 
                                // Actually if we update DB now, the `studentsToInsert` push below will use newUid.
                                // The bulk upsert will then see newUid in values, match row by name/dob, and update other fields.
                                // BUT wait, `uid` column in INSERT is usually ignored on conflict? 
                                // Yes, unless `uid = EXCLUDED.uid` is in SET clause.

                                console.log(`[IMPORT SELF-HEALING] Repaired Broken Auth Link (New UID: ${newUid})`);
                            }
                        }
                        // --- END SELF-HEALING ---

                        console.log(`[IMPORT] Student found (The Guard): ${student.firstName} ${student.lastName} (${uid}). Auth Checked.`);
                        processedUIDs.add(uid);
                    } else {
                        // NEW
                        uid = `student-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                        if (!finalEmail) finalEmail = `${uid}@pledgeum.provisoire`;

                        console.log(`[IMPORT] New Student: ${student.firstName} ${student.lastName}. Creating Auth.`);

                        authTasks.push(
                            adminAuth.createUser({
                                uid,
                                email: finalEmail,
                                displayName: `${student.firstName} ${student.lastName}`,
                                password: 'InitialPassword123!'
                            }).then(() => {
                                return adminAuth.setCustomUserClaims(uid, { role: 'student', schoolId });
                            }).catch((err) => {
                                console.error(`[AUTH ERROR] Failed to create ${finalEmail}:`, err.message);
                            })
                        );

                        processedUIDs.add(uid);
                    }

                    studentsToInsert.push({
                        uid,
                        finalEmail,
                        firstName: student.firstName,
                        lastName: student.lastName,
                        dob,
                        schoolId,
                        classId: realClassId
                    });

                } catch (e: any) {
                    console.error("Error processing student row:", e);
                    stats.errors++;
                }
            }
        }

        // ------------------------------------------------------------------
        // STEP 4: BULK INSERT EXECUTION (Upsert)
        // ------------------------------------------------------------------
        if (studentsToInsert.length > 0) {
            console.log(`[DEBUG] Upserting ${studentsToInsert.length} students...`);

            const chunkSize = 50;
            for (let i = 0; i < studentsToInsert.length; i += chunkSize) {
                const chunk = studentsToInsert.slice(i, i + chunkSize);

                const values: any[] = [];
                const placeholders: string[] = [];
                let p = 1;

                chunk.forEach(s => {
                    values.push(s.uid, s.finalEmail, 'student', s.firstName, s.lastName, s.dob, s.schoolId, s.classId);
                    placeholders.push(`($${p}, $${p + 1}, $${p + 2}, $${p + 3}, $${p + 4}, $${p + 5}, $${p + 6}, $${p + 7}, TRUE, NOW())`);
                    p += 8;
                });

                const query = `
                    INSERT INTO users (uid, email, role, first_name, last_name, birth_date, establishment_uai, class_id, is_active, created_at)
                    VALUES ${placeholders.join(', ')}
                    ON CONFLICT (upper(public.immutable_unaccent(last_name)), upper(public.immutable_unaccent(first_name)), birth_date) WHERE role = 'student'
                    DO UPDATE SET 
                        class_id = EXCLUDED.class_id, 
                        is_active = TRUE, 
                        updated_at = NOW(),
                        establishment_uai = EXCLUDED.establishment_uai 
                `;

                try {
                    await client.query(query, values);
                    stats.studentsCreated += chunk.length;
                } catch (err: any) {
                    console.error("Bulk Upsert Error:", err.message);
                    throw err;
                }
            }
        }

        // Execute Auth Tasks
        if (authTasks.length > 0) await Promise.allSettled(authTasks);

        // ------------------------------------------------------------------
        // STEP 5: ARCHIVE MISSING
        // ------------------------------------------------------------------
        for (const uid of existingActiveUids) {
            if (!processedUIDs.has(uid)) {
                await client.query('UPDATE users SET is_active = FALSE WHERE uid = $1', [uid]);
                stats.studentsArchived++;
            }
        }

        return NextResponse.json({ success: true, stats });

    } catch (e: any) {
        console.error("Import Fatal:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    } finally {
        if (client) client.release();
    }
}
