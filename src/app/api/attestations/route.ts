import { NextResponse } from 'next/server';
import pool from '@/lib/pg';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

/**
 * Hub des Attestations - API Isolée V2
 * Sécurité : Filtrage strict par rôle et UAI/UserID
 */
export async function GET(req: Request) {
    let client;
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        client = await pool.connect();

        // 1. Fetch official role and UAI from DB to avoid session stale data
        const userRes = await client.query(
            'SELECT uid, role, establishment_uai FROM users WHERE email = $1', 
            [session.user.email.toLowerCase().trim()]
        );
        const dbUser = userRes.rows[0];
        if (!dbUser) {
            return NextResponse.json({ error: "User not found in database" }, { status: 404 });
        }

        const userId = dbUser.uid;
        const userRole = dbUser.role;
        const userUai = dbUser.establishment_uai;
        const email = session.user.email.toLowerCase().trim();

        // 2. Build secure dynamic query
        let query = `
            SELECT 
                c.id, 
                TO_CHAR(c.date_start, 'YYYY-MM-DD') as date_start, 
                TO_CHAR(c.date_end, 'YYYY-MM-DD') as date_end, 
                c.status as convention_status,
                comp.name as company_name,
                u.first_name as student_first_name, 
                u.last_name as student_last_name,
                cl.name as class_name,
                cl.id as class_id,
                att.signature_date as attestation_signed_at
            FROM conventions c
            JOIN users u ON c.student_uid = u.uid
            JOIN classes cl ON u.class_id = cl.id
            LEFT JOIN companies comp ON c.company_siret = comp.siret
            LEFT JOIN attestations att ON c.id = att.convention_id
            WHERE c.status IN ('VALIDATED_HEAD', 'COMPLETED')
        `;

        const params: any[] = [];
        let paramIndex = 1;

        // Security check per role
        const staffRoles = ['school_head', 'ddfpt', 'at_ddfpt', 'teacher', 'admin', 'SUPER_ADMIN'];
        const companyRoles = ['tutor', 'company_head', 'company_head_tutor'];

        if (staffRoles.includes(userRole)) {
            if (userRole === 'teacher') {
                // Teacher: Restricted to their assigned classes (Main Teacher OR in Assignments table)
                query += ` AND (cl.main_teacher_id = $${paramIndex} OR cl.id IN (SELECT class_id FROM teacher_assignments WHERE teacher_uid = $${paramIndex}))`;
                params.push(userId);
                paramIndex++;
            } else if (userRole !== 'SUPER_ADMIN') {
                // Direction (school_head, ddfpt, etc.): Global UAI access
                if (!userUai) {
                    return NextResponse.json({ success: true, data: [] });
                }
                query += ` AND cl.establishment_uai = $${paramIndex}`;
                params.push(userUai);
                paramIndex++;
            }
        } 
        else if (userRole === 'student') {
            // Student sees only their own
            query += ` AND c.student_uid = $${paramIndex}`;
            params.push(userId);
            paramIndex++;
        }
        else if (companyRoles.includes(userRole)) {
            // Tutor / Company Head sees what they signed/manage
            query += ` AND (LOWER(c.metadata->>'tuteur_email') = $${paramIndex} OR LOWER(c.metadata->>'ent_rep_email') = $${paramIndex})`;
            params.push(email);
            paramIndex++;
        }
        else {
            // Other roles (like parent) - potentially restricted or empty for now
            return NextResponse.json({ success: true, data: [] });
        }

        query += ` ORDER BY c.date_end DESC;`;

        const result = await client.query(query, params);

        return NextResponse.json({ 
            success: true, 
            data: result.rows,
            _scope: userRole
        });

    } catch (error: any) {
        console.error("[API_ATTESTATIONS] GET Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
        if (client) client.release();
    }
}
