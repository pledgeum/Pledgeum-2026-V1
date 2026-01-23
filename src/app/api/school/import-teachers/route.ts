
import { NextResponse } from 'next/server';
import pool from '@/lib/pg';
import { z } from 'zod';
import { adminAuth } from '@/lib/firebase-admin'; // Added
import crypto from 'crypto'; // Added

// Helper for normalization (matches Import Structure logic)
function normalizeString(str: string) {
    if (!str) return '';
    return str.trim().toUpperCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Zod Schema
const TeacherImportSchema = z.object({
    schoolId: z.string(),
    schoolYear: z.string().default('2025-2026'),
    teachers: z.array(z.object({
        teacher: z.object({
            firstName: z.string(),
            lastName: z.string(),
            email: z.string().optional(),
        }),
        classes: z.array(z.string()) // Simple class names
    }))
});

export async function POST(req: Request) {
    let client;
    try {
        const body = await req.json();
        const { schoolId, teachers } = TeacherImportSchema.parse(body);

        if (!schoolId) return NextResponse.json({ error: "School ID (UAI) required" }, { status: 400 });

        client = await pool.connect();

        // 1. Prefetch all Classes for this School to minimize DB hits
        // We map Normalized Name -> Real UUID
        const classesRes = await client.query(
            `SELECT id, name FROM classes WHERE establishment_uai = $1`,
            [schoolId]
        );

        const classMap = new Map<string, string>();
        classesRes.rows.forEach(row => {
            // Store both exact and normalized variations
            classMap.set(row.name, row.id);
            classMap.set(normalizeString(row.name), row.id);
            // Also handle "2NDE2" vs "2NDE 2" if needed, but strict is safer for now
        });

        const stats = {
            created: 0,
            updated: 0,
            errors: 0,
            assignments: 0
        };

        // 2. Process Teachers
        for (const item of teachers) {
            try {
                const { teacher, classes } = item;

                // --- A. Upsert Teacher User ---
                let uid = null;

                // We generate a UID if creating, but we try to find first.
                // Postgres UPSERT with ON CONFLICT (email)

                if (teacher.email) {
                    const insertQuery = `
                        INSERT INTO users (uid, email, role, first_name, last_name, establishment_uai, created_at, is_active)
                        VALUES (
                            $1, 
                            $2, 
                            'teacher', 
                            $3, 
                            $4, 
                            $5, 
                            NOW(), 
                            TRUE
                        )
                        ON CONFLICT (email) DO UPDATE SET
                            first_name = EXCLUDED.first_name,
                            last_name = EXCLUDED.last_name,
                            establishment_uai = EXCLUDED.establishment_uai,
                            updated_at = NOW()
                        RETURNING uid, (xmax = 0) as is_new
                    `;

                    // Generate a candidate UID (will be used if INSERT, ignored if UPDATE usually? No, ON CONFLICT ignores value for existing row PK?)
                    // Wait, if we use a randomly generated UID in VALUES, but it conflicts on EMAIL, the UID in DB remains the OLD one.
                    // Correct. so we can pass a new UID.
                    const candidateUid = `teacher-${crypto.randomUUID()}`;

                    const res = await client.query(insertQuery, [
                        candidateUid,
                        teacher.email.toLowerCase(),
                        teacher.firstName,
                        teacher.lastName,
                        schoolId
                    ]);

                    uid = res.rows[0].uid;
                    if (res.rows[0].is_new) stats.created++; else stats.updated++;

                } else {
                    // No Email? Fallback to Name + UAI lookup (Strict Guard)
                    const searchRes = await client.query(
                        `SELECT uid FROM users 
                         WHERE establishment_uai = $1 
                           AND role = 'teacher' 
                           AND unaccent(lower(last_name)) = unaccent(lower($2)) 
                           AND unaccent(lower(first_name)) = unaccent(lower($3))
                         LIMIT 1`,
                        [schoolId, teacher.lastName, teacher.firstName]
                    );

                    if (searchRes.rows.length > 0) {
                        uid = searchRes.rows[0].uid;
                        stats.updated++;
                        console.log(`[IMPORT TEACHER] Found existing by name: ${teacher.firstName} ${teacher.lastName} (${uid})`);
                    } else {
                        // Create
                        uid = `teacher-${crypto.randomUUID()}`;
                        console.log(`[IMPORT TEACHER] Creating new: ${teacher.firstName} ${teacher.lastName} (${uid})`);

                        const tempEmail = `${uid}@pledgeum.temp`;

                        await client.query(`
                            INSERT INTO users (uid, email, role, first_name, last_name, establishment_uai, created_at, is_active)
                            VALUES ($1, $2, 'teacher', $3, $4, $5, NOW(), TRUE)
                        `, [uid, tempEmail, teacher.firstName, teacher.lastName, schoolId]);

                        // Create Auth
                        try {
                            await adminAuth.createUser({
                                uid,
                                email: tempEmail,
                                displayName: `${teacher.firstName} ${teacher.lastName}`,
                                password: 'InitialPassword123!'
                            });
                            await adminAuth.setCustomUserClaims(uid, { role: 'teacher', schoolId });
                        } catch (authErr) {
                            console.error(`[IMPORT TEACHER] Auth Create Error for ${tempEmail}:`, authErr);
                        }

                        stats.created++;
                    }
                }

                // --- B. SELF-HEALING AUTH FOR TEACHER ---
                if (uid) {
                    try {
                        await adminAuth.getUser(uid);
                    } catch (e: any) {
                        if (e.code === 'auth/user-not-found') {
                            const newUid = `teacher-${crypto.randomUUID()}`;
                            console.log(`[IMPORT TEACHER] Repairing Broken Auth for ${teacher.firstName} ${teacher.lastName} (Old: ${uid} -> New: ${newUid})`);

                            const repairEmail = teacher.email || `${newUid}@pledgeum.temp`;

                            try {
                                await adminAuth.createUser({
                                    uid: newUid,
                                    email: repairEmail,
                                    displayName: `${teacher.firstName} ${teacher.lastName}`,
                                    password: 'InitialPassword123!'
                                });
                                await adminAuth.setCustomUserClaims(newUid, { role: 'teacher', schoolId });

                                // Update Postgres
                                await client.query('UPDATE users SET uid = $1 WHERE uid = $2', [newUid, uid]);
                                uid = newUid;
                                stats.updated++;
                            } catch (repairErr: any) {
                                console.error(`[IMPORT TEACHER] Repair Failed for ${repairEmail}:`, repairErr.message);
                            }
                        }
                    }
                }

                // --- C. Link Classes (Assignments) ---
                if (uid && classes.length > 0) {
                    for (const className of classes) {
                        const targetClassId = classMap.get(className) || classMap.get(normalizeString(className));

                        if (targetClassId) {
                            const check = await client.query(
                                `SELECT id FROM teacher_assignments WHERE teacher_uid = $1 AND class_id = $2`,
                                [uid, targetClassId]
                            );

                            if (check.rowCount === 0) {
                                await client.query(
                                    `INSERT INTO teacher_assignments (teacher_uid, class_id) VALUES ($1, $2)`,
                                    [uid, targetClassId]
                                );
                                stats.assignments++;
                            }
                        }
                    }
                }

            } catch (err) {
                console.error("Error processing teacher:", err);
                stats.errors++;
            }
        }

        return NextResponse.json({ success: true, stats });

    } catch (err: any) {
        console.error("[API] Teacher Import Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    } finally {
        if (client) client.release();
    }
}
