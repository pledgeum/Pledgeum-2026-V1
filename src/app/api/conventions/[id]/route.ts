export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import pool from '@/lib/pg';
import { auth } from '@/auth';
import { validateAccess } from '@/lib/server-security';

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session || !session.user || !session.user.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: conventionId } = await params;

        if (!pool) {
            return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
        }

        const client = await pool.connect();
        try {
            // 1. Fetch LIVE User Data from Postgres for security check
            const userRes = await client.query('SELECT role, uid, establishment_uai FROM users WHERE email = $1', [session.user.email.toLowerCase().trim()]);
            const dbUser = userRes.rows[0];

            if (!dbUser) {
                return NextResponse.json({ error: 'User not found' }, { status: 404 });
            }

            const userRole = dbUser.role;
            const userId = dbUser.uid;
            const userUai = dbUser.establishment_uai;

            // 2. Fetch Convention Data
            const queryStr = `
                SELECT 
                    c.id,
                    c.status,
                    c.metadata,
                    c.duration_hours as "durationHours",
                    TO_CHAR(c.date_start, 'YYYY-MM-DD') as "dateStart",
                    TO_CHAR(c.date_end, 'YYYY-MM-DD') as "dateEnd",
                    c.is_out_of_period as "is_out_of_period",
                    c.validated_at as "validatedAt",
                    c.signature_company_at as "signatureCompanyAt",
                    c.signature_school_at as "signatureSchoolAt",
                    c.tutor_email as "tutorEmail",
                    c.tutor_name as "tutorName",
                    c.company_siret as "companySiret",
                    c.student_uid as "studentId",
                    c.establishment_uai as "establishmentUai",
                    c.establishment_uai as "schoolId",
                    c.class_id as "classId",
                    c.pdf_hash as "pdfHash",
                    c.rejection_reason as "rejectionReason",
                    c.token_company as "tokenCompany",
                    c.token_school as "tokenSchool",
                    c.created_at as "createdAt",
                    c.updated_at as "updatedAt",
                    COALESCE(
                        (
                            SELECT jsonb_agg(jsonb_build_object(
                                'id', a.id,
                                'type', a.type,
                                'date', TO_CHAR(a.date, 'YYYY-MM-DD'),
                                'duration', a.duration,
                                'reason', a.reason,
                                'reportedBy', a.reported_by,
                                'reportedAt', a.reported_at
                            ))
                            FROM absences a WHERE a.convention_id = c.id
                        ), '[]'::jsonb
                    ) as absences,
                    -- LIVE TEACHER DATA
                    u.email as "teacherEmail",
                    u.first_name as "teacherFirstName",
                    u.last_name as "teacherLastName",
                    -- VISITS DATA
                    v.tracking_teacher_email,
                    v.distance_km AS visit_distance_km,
                    v.status AS visit_status,
                    v.scheduled_date AS visit_scheduled_date,
                    v.draft_tracking_teacher_email,
                    v.draft_distance_km,
                    tu.first_name AS tracking_teacher_first_name,
                    tu.last_name AS tracking_teacher_last_name,
                    est.address AS school_address,
                    est.postal_code AS school_zip_code,
                    est.city AS school_city,
                    -- ATTESTATION DATA
                    att.total_days_present AS attestation_total_jours,
                    att.absences_hours AS attestation_absences_hours,
                    att.activities AS activites,
                    att.skills_evaluation AS attestation_competences,
                    att.gratification_amount AS attestation_gratification,
                    att.signer_name AS attestation_signer_name,
                    att.signer_function AS attestation_signer_function,
                    TO_CHAR(att.signature_date, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "attestationDate",
                    att.signature_img AS attestation_signature_img,
                    att.signature_code AS attestation_signature_code,
                    att.pdf_hash AS "attestationHash",
                    -- EVALUATION DATA
                    ev.answers AS "evaluationAnswers",
                    ev.final_grade AS "evaluationFinalGrade",
                    ev.teacher_signed_at AS "evaluationDate",
                    -- TUTOR PERSONAL DATA
                    tuteur.phone AS "tuteur_telephone",
                    signataire.phone AS "signataire_telephone"
                FROM conventions c
                LEFT JOIN classes cls ON c.class_id = cls.id
                LEFT JOIN establishments est ON c.establishment_uai = est.uai
                LEFT JOIN users u ON cls.main_teacher_id = u.uid
                LEFT JOIN visits v ON c.id = v.convention_id
                LEFT JOIN users tu ON v.tracking_teacher_email = tu.email
                LEFT JOIN attestations att ON c.id = att.convention_id
                LEFT JOIN evaluations ev ON c.id = ev.convention_id AND ev.status = 'FINALIZED'
                LEFT JOIN users tuteur ON LOWER(COALESCE(c.tutor_email, c.metadata->>'tuteur_email')) = LOWER(tuteur.email)
                LEFT JOIN users signataire ON LOWER(c.metadata->>'ent_rep_email') = LOWER(signataire.email)
                WHERE c.id = $1
            `;

            const res = await client.query(queryStr, [conventionId]);

            if (res.rowCount === 0) {
                return NextResponse.json({ error: 'Convention not found' }, { status: 404 });
            }

            const convention = res.rows[0];

            // 3. Authorization Check
            if (!validateAccess(session, convention)) {
                return NextResponse.json({ error: 'Unauthorized access to this convention' }, { status: 403 });
            }

            // Map and return
            const mappedConvention = {
                ...convention,
                attestationSigned: !!convention.attestationDate,
                signatures: convention.metadata?.signatures || {},
                visit: convention.tracking_teacher_email || convention.draft_tracking_teacher_email ? {
                    tracking_teacher_email: convention.tracking_teacher_email,
                    tracking_teacher_first_name: convention.tracking_teacher_first_name,
                    tracking_teacher_last_name: convention.tracking_teacher_last_name,
                    distance_km: convention.visit_distance_km,
                    status: convention.visit_status,
                    scheduled_date: convention.visit_scheduled_date,
                    draft_tracking_teacher_email: convention.draft_tracking_teacher_email,
                    draft_distance_km: convention.draft_distance_km
                } : null,
                prof_suivi_email: convention.tracking_teacher_email || convention.metadata?.prof_suivi_email || null,
                school: {
                    address: convention.school_address,
                    zipCode: convention.school_zip_code,
                    city: convention.school_city
                }
            };

            return NextResponse.json({ success: true, convention: mappedConvention });

        } finally {
            client.release();
        }
    } catch (error: any) {
        console.error('[API_GET_CONVENTION] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    // Forward to PUT for now, or implement separate logic if needed
    return PUT(req, { params });
}

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: conventionId } = await params;
        const body = await req.json();

        // Remove ID from body if present to avoid updating it
        const { id, ...updates } = body;

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ success: true, message: 'No updates provided' });
        }

        const client = await pool.connect();
        try {
            // 0. Security Check: Fetch convention first to verify access
            const convRes = await client.query('SELECT * FROM conventions WHERE id = $1', [conventionId]);
            if (convRes.rowCount === 0) {
                return NextResponse.json({ error: 'Convention not found' }, { status: 404 });
            }
            const convention = convRes.rows[0];

            if (!validateAccess(session, convention)) {
                return NextResponse.json({ error: 'You do not have permission to modify this convention' }, { status: 403 });
            }

            // Map frontend camelCase to DB snake_case
            const fieldMap: Record<string, string> = {
                dateStart: 'date_start',
                dateEnd: 'date_end',
                studentId: 'student_uid',
                companySiret: 'company_siret',
                tutorName: 'tutor_name',
                tutorEmail: 'tutor_email',
                tutorPhone: 'tutor_phone',
                tutorFunction: 'tutor_function',
                mentorName: 'mentor_name',
                mentorEmail: 'mentor_email',
                mentorPhone: 'mentor_phone',
                mentorFunction: 'mentor_function',
                stageTitle: 'stage_title',
                missionObjectives: 'mission_objectives',
                mainActivities: 'main_activities',
                skillsDeveloped: 'skills_developed',
                weeklyHours: 'weekly_hours',
                dailySchedule: 'daily_schedule',
                workConditions: 'work_conditions',
                healthSafety: 'health_safety',
                companyName: 'ent_nom',
                companyAddress: 'ent_adresse',
                companyZip: 'ent_code_postal',
                companyCity: 'ent_ville',
                companyEmail: 'ent_email',
                companyPhone: 'ent_phone',
                representativeName: 'ent_rep_nom',
                representativeEmail: 'ent_rep_email',
                representativeFunction: 'ent_rep_fonction',
                studentPhone: 'eleve_telephone',
                studentAddress: 'eleve_adresse',
                studentZip: 'eleve_code_postal',
                studentCity: 'eleve_ville',
                studentClass: 'eleve_classe',
                studentBirthDate: 'eleve_date_naissance',
                studentSecu: 'eleve_secu',
                legalRepName: 'rep_legal_nom',
                legalRepEmail: 'rep_legal_email',
                legalRepPhone: 'rep_legal_phone',
                legalRepAddress: 'rep_legal_adresse',
                legalRepZip: 'rep_legal_code_postal',
                legalRepCity: 'rep_legal_ville',
                establishmentUai: 'establishment_uai',
                headName: 'ecole_chef_nom',
                headEmail: 'ecole_chef_email',
                teacherName: 'prof_nom',
                teacherEmail: 'prof_email',
                assuranceName: 'assurance_nom',
                assurancePolicy: 'assurance_police',
                is_out_of_period: 'is_out_of_period'
            };

            const dbUpdates: any = {};
            const metadataUpdates: any = {};
            let hasMetadataUpdates = false;

            for (const [key, value] of Object.entries(updates)) {
                if (fieldMap[key]) {
                    dbUpdates[fieldMap[key]] = value;
                } else if (key === 'metadata') {
                    // Skip or handle explicit metadata if needed
                } else {
                    metadataUpdates[key] = value;
                    hasMetadataUpdates = true;
                }
            }

            await client.query('BEGIN');

            const setClauses: string[] = [];
            const values: any[] = [];
            let pIdx = 1;

            for (const [col, val] of Object.entries(dbUpdates)) {
                setClauses.push(`${col} = $${pIdx}`);
                values.push(val);
                pIdx++;
            }

            if (hasMetadataUpdates) {
                setClauses.push(`metadata = COALESCE(metadata, '{}'::jsonb) || $${pIdx}::jsonb`);
                values.push(JSON.stringify(metadataUpdates));
                pIdx++;
            }

            setClauses.push(`updated_at = NOW()`);

            const query = `
                UPDATE conventions 
                SET ${setClauses.join(', ')}
                WHERE id = $${pIdx}
                RETURNING id, student_uid, status, metadata, date_start, date_end, establishment_uai, created_at, updated_at
            `;
            values.push(conventionId);

            const res = await client.query(query, values);

            if (res.rowCount === 0) {
                await client.query('ROLLBACK');
                return NextResponse.json({ error: 'Convention not found' }, { status: 404 });
            }

            await client.query('COMMIT');
            return NextResponse.json({ success: true, data: res.rows[0] });

        } catch (error: any) {
            if (client) await client.query('ROLLBACK');
            console.error('[API_UPDATE_CONVENTION] Error:', error);
            return NextResponse.json({ error: 'Database error', details: error.message }, { status: 500 });
        } finally {
            client.release();
        }

    } catch (error: any) {
        console.error('[API_PUT_CONVENTION] Internal Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
