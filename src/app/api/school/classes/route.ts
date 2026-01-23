
import { NextResponse } from 'next/server';
import pool from '@/lib/pg';
import { adminAuth, adminDb as db } from '@/lib/firebase-admin';

// PUT: Update Class (Assign Main Teacher)
export async function PUT(req: Request) {
    let client;
    try {
        const body = await req.json();
        const { classId, mainTeacherId, uai } = body; // classId is the Firestore ID (simple class ID)

        if (!classId || !uai) {
            return NextResponse.json({ error: "Missing classId or uai" }, { status: 400 });
        }

        client = await pool.connect();

        // Construct PG Class ID
        // HYBRID LOGIC: Support both explicit UUIDs/Random IDs and Legacy "Name_UAI" composites.
        // We assume the frontend might send a "Simple ID" (legacy) or a "Full ID" (new).

        // Strategy: First try the ID as provided. If that fails (in update), we might need logic.
        // For Update, we need to target the correct row.
        // Since we can't easily "try" in one Update statement query without complexity,
        // Let's assume: If the ID does NOT contain the UAI (and isn't obviously a UUID?), it MIGHT be a legacy short ID.

        // Better: We check DB existence? No, equivalent to 2 queries.
        // Heuristic: If ID was stripped in GET, it was "ShortID". 
        // We reconstruct the Composite: `${classId}_${uai}`.

        let pgClassId = classId;

        // Check if this looks like a Legacy ID (Does not contain UAI, assuming UAI is 8 chars).
        // Safest: Check if the provided ID works. If not, try composite.
        // Let's do a quick SELECT or Updated Row check.
        // Actually, let's just use the `RETURNING id` clause to see if we hit something.

        const tryUpdate = async (idToTest: string) => {
            return client.query(`
                UPDATE classes 
                SET main_teacher_id = $1, updated_at = NOW()
                WHERE id = $2
                RETURNING id
            `, [mainTeacherId || null, idToTest]);
        };

        // 1. Fetch Teacher Details (Moved up for availability)
        let teacherDetails = null;
        if (mainTeacherId) {
            const teacherRes = await client.query('SELECT first_name, last_name, email FROM users WHERE uid = $1', [mainTeacherId]);
            if (teacherRes.rowCount && teacherRes.rowCount > 0) {
                const t = teacherRes.rows[0];
                teacherDetails = {
                    id: mainTeacherId,
                    firstName: t.first_name,
                    lastName: t.last_name,
                    email: t.email
                };
            }
        }

        let updateRes = await tryUpdate(pgClassId);

        if (updateRes.rowCount === 0) {
            // Try Legacy Composite
            const legacyId = `${classId}_${uai}`;
            if (legacyId !== pgClassId) {
                console.log(`[API] Primary ID update failed. Trying Legacy ID: ${legacyId}`);
                updateRes = await tryUpdate(legacyId);
                if (updateRes.rowCount > 0) {
                    pgClassId = legacyId; // Confirmed it's legacy
                }
            }
        }

        if (updateRes.rowCount === 0) {
            // Still 0? Maybe class doesn't exist.
            console.warn(`[API] Update Class Failed: Class ${classId} not found (tried raw and legacy).`);
            // We don't error out 404 to avoid crashing UI flows, but warn.
        }

        // 2. Sync to Firestore
        // Path: establishments/{uai}/years/2025-2026/classes/{classId}
        // Firestore uses the Frontend ID (classId passed in params, usually Short for legacy).
        // This preserves the link with Students who use Short ID (Legacy).
        const year = "2025-2026";
        const classRef = db.doc(`establishments/${uai}/years/${year}/classes/${classId}`);

        await classRef.set({
            mainTeacherId: mainTeacherId || null,
            mainTeacher: teacherDetails || null,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        return NextResponse.json({ success: true, mainTeacher: teacherDetails });

    } catch (error: any) {
        console.error("[API] Update Class Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
        if (client) client.release();
    }
}

// GET: Fetch Classes with Enriched Main Teacher
export async function GET(req: Request) {
    let client;
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
                u.email as teacher_email,
                (SELECT COUNT(*) FROM users s WHERE s.class_id = c.id AND s.role = 'student') as student_count,
                (SELECT COUNT(DISTINCT teacher_uid) FROM teacher_assignments ta WHERE ta.class_id = c.id) as teacher_count
            FROM classes c
            LEFT JOIN users u ON c.main_teacher_id = u.uid::text
            WHERE c.establishment_uai = $1
        `;

        console.log("[API] Executing Class Query:", query, "Params:", [uai]);
        const res = await client.query(query, [uai]);

        const classes = res.rows.map(row => {
            // HYBRID LOGIC: 
            // If ID ends with `_${uai}`, assuming Legacy -> Strip it for frontend (Short ID).
            // Else -> Keep Key (New Random/UUID).
            let simpleId = row.pg_id;
            if (simpleId.endsWith(`_${uai}`)) {
                simpleId = simpleId.substring(0, simpleId.length - (uai.length + 1));
            }

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
                } : null
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
