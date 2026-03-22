export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import pool from '@/lib/pg';
import { auth } from '@/auth';
import crypto from 'crypto';
import { findOrCreateUser } from '@/lib/db/users';
import { getCoordinates } from '@/lib/geocoding';
import { getCompanyInfoBySiret } from '@/lib/api-gouv';

export async function GET(request: Request) {
    const session = await auth();
    if (!session || !session.user || !session.user.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const uai = searchParams.get('uai');
    const studentId = searchParams.get('studentId');
    const limit = parseInt(searchParams.get('limit') || '100');

    if (!pool) {
        return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
    }

    const client = await pool.connect();
    try {
        console.log(`[API_CONVENTIONS] GET request for ${session.user.email}`);
        // 1. Fetch LIVE User Data from Postgres (Session JWT might be stale/missing UAI)
        const userRes = await client.query('SELECT role, establishment_uai FROM users WHERE email = $1', [session.user.email.toLowerCase().trim()]);
        const dbUser = userRes.rows[0];

        let userRole = dbUser?.role || (session.user as any).role;
        let userEstablishmentUai = dbUser?.establishment_uai || (session.user as any).establishment_uai;

        console.log(`[API_CONVENTIONS] DB User:`, { email: session.user.email, userRole, userEstablishmentUai });

        // 2. School Head Fallback: If UAI is missing on user, check if they are admin of an establishment
        if (userRole === 'school_head' && !userEstablishmentUai) {
            const estRes = await client.query('SELECT uai FROM establishments WHERE admin_email = $1', [session.user.email.toLowerCase().trim()]);
            if (estRes.rowCount && estRes.rowCount > 0) {
                userEstablishmentUai = estRes.rows[0].uai;
                console.log(`[API_CONVENTIONS] Applied School Head Fallback UAI: ${userEstablishmentUai} for ${session.user.email}`);
            }
        }

        const companyRoles = ['tutor', 'company_head', 'company_head_tutor'];
        if (userRole !== 'SUPER_ADMIN' && userRole !== 'parent' && !companyRoles.includes(userRole) && !userEstablishmentUai) {
            console.error('[API_CONVENTIONS] Security Alert: User has no establishment_uai linked. Returning empty.', { userEmail: session.user.email, userRole });
            return NextResponse.json({ success: true, conventions: [], count: 0, debug: "NO_UAI" });
        }

        // SYSTEMIC FIX: Fetch Live Teacher Data via JOIN (Snapshots are ignored for Teacher Email)
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
                c.type as "type",
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
                -- TUTOR & SIGNATAIRE PERSONAL DATA
                tuteur.phone AS "tuteur_telephone",
                signataire.phone AS "signataire_telephone"
            FROM conventions c
            LEFT JOIN classes cls ON c.class_id = cls.id
            LEFT JOIN establishments est ON c.establishment_uai = est.uai
            LEFT JOIN users u ON cls.main_teacher_id = u.uid
            LEFT JOIN visits v ON c.id = v.convention_id
            LEFT JOIN users tu ON v.tracking_teacher_email = tu.email
            LEFT JOIN attestations att ON c.id = att.convention_id
            LEFT JOIN users tuteur ON LOWER(COALESCE(c.tutor_email, c.metadata->>'tuteur_email')) = LOWER(tuteur.email)
            LEFT JOIN users signataire ON LOWER(c.metadata->>'ent_rep_email') = LOWER(signataire.email)
            WHERE 1=1
        `;

        let query = queryStr;
        const params: any[] = [];
        let paramIndex = 1;

        if (userRole === 'parent') {
            // Parent: Fetch by Legal Representative Email
            // Case insensitive comparison for robustness
            query += ` AND LOWER(c.metadata->>'rep_legal_email') = LOWER($${paramIndex})`;
            params.push(session.user.email);
            paramIndex++;
        } else if (companyRoles.includes(userRole)) {
            // Tutor or Company Head: Fetch by their email in metadata AND restricted status
            // They see conventions regardless of UAI (since they can bridge multiple schools)
            query += ` AND (LOWER(c.metadata->>'tuteur_email') = LOWER($${paramIndex}) OR LOWER(c.metadata->>'ent_rep_email') = LOWER($${paramIndex}))`;
            params.push(session.user.email);
            paramIndex++;

            // Apply Status Filter: Only show once Student + Parent + Teacher have acted
            // Workflow: Student signs -> SUBMITTED | Parent signs -> SIGNED_PARENT | Teacher validates -> VALIDATED_TEACHER
            query += ` AND c.status IN ('VALIDATED_TEACHER', 'SIGNED_COMPANY', 'SIGNED_TUTOR', 'VALIDATED_HEAD')`;
        } else if (userRole === 'student') {
            // Student: Strict UAI filter AND self-identity filter (UID primary, Email fallback)
            query += ` AND c.establishment_uai = $${paramIndex}`;
            params.push(userEstablishmentUai);
            paramIndex++;

            query += ` AND (c.student_uid = $${paramIndex} OR c.student_uid = $${paramIndex + 1})`;
            params.push((session.user as any).id);
            params.push(session.user.email);
            paramIndex += 2;
        } else if (userRole !== 'SUPER_ADMIN') {
            // Default (School Admin, Teacher, Student?): Fetch by Establishment UAI
            query += ` AND c.establishment_uai = $${paramIndex}`;
            params.push(userEstablishmentUai);
            paramIndex++;
        } else if (uai) {
            // Super Admin with explicit UAI filter
            query += ` AND c.establishment_uai = $${paramIndex}`;
            params.push(uai);
            paramIndex++;
        }

        if (studentId) {
            query += ` AND c.student_uid = $${paramIndex}`;
            params.push(studentId);
            paramIndex++;
        }

        query += ` ORDER BY c.updated_at DESC LIMIT $${paramIndex}`;
        params.push(limit);

        const res = await client.query(query, params);

        const conventions = res.rows.map(c => ({
            ...c,
            attestationSigned: !!c.attestationDate,
            signatures: c.metadata?.signatures || {}, // Flatten signatures for frontend compatibility
                visit: c.tracking_teacher_email || c.draft_tracking_teacher_email ? {
                    tracking_teacher_email: c.tracking_teacher_email,
                    tracking_teacher_first_name: c.tracking_teacher_first_name,
                    tracking_teacher_last_name: c.tracking_teacher_last_name,
                    distance_km: c.visit_distance_km,
                    status: c.visit_status,
                    scheduled_date: c.visit_scheduled_date,
                    // Draft Data
                    draft_tracking_teacher_email: c.draft_tracking_teacher_email,
                    draft_distance_km: c.draft_distance_km
                } : null,
            prof_suivi_email: c.tracking_teacher_email || c.metadata?.prof_suivi_email || null,
            school: {
                address: c.school_address || c.ecole_adresse,
                zipCode: c.school_zip_code || '',
                city: c.school_city || ''
            }
        }));

        return NextResponse.json({
            success: true,
            conventions: conventions,
            count: res.rowCount,
            _debug: {
                userRole,
                userEstablishmentUai,
                params,
                queryLength: query.length
            }
        });

    } catch (error: any) {
        console.error('[API_CONVENTIONS] Fatal Error:', error);
        return NextResponse.json({ 
            success: false, 
            error: error.message || 'Internal Server Error',
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 });
    } finally {
        if (client) client.release();
    }
}

// ... (imports)

// Helper to send emails safely without blocking the response
const safeSendEmail = async (params: any) => {
    try {
        const { sendEmail } = await import('@/lib/email');
        const result = await sendEmail(params);
        if (!result.success) {
            console.error('[API_CONVENTIONS] Email Error:', result.error);
            return { type: 'EMAIL_FAILED', detail: result.error };
        }
        return null;
    } catch (e: any) {
        console.error('[API_CONVENTIONS] Email Exception:', e);
        return { type: 'EMAIL_EXCEPTION', detail: e.message };
    }
};

export async function POST(req: Request) {
    let emailWarning: { type: string, detail: string } | null = null;
    try {
        const session = await auth();
        if (!session || !session.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { studentId, ...data } = body;

        // 1. Récupération ROBUSTE de l'UAI (Session uniquement pour Student, sinon fallback DB)
        let uai = (session.user as any)?.establishment_uai;
        const classId = data.class_id || data.eleve_classe_id || data.metadata?.class_id;

        const client = await pool.connect();
        try {
            if (!uai && classId) {
                console.log(`[API_CONVENTIONS] UAI missing from session, attempting derivation from class_id: ${classId}`);
                const classRes = await client.query('SELECT establishment_uai FROM classes WHERE id = $1', [classId]);
                if (classRes.rowCount && classRes.rowCount > 0) {
                    uai = classRes.rows[0].establishment_uai;
                }
            }

            // 2. Garde-fou strict : Rejeter la requête si l'UAI est introuvable
            if (!uai) {
                console.error('[API_CONVENTIONS] POST Refused: No UAI found for user', session.user.email);
                return NextResponse.json(
                    { error: "L'identifiant de l'établissement (UAI) est manquant. Impossible de créer la convention." },
                    { status: 400 }
                );
            }

            // --- PRE-IDENTIFICATION ---
            const conventionsId = 'conv_' + Math.random().toString(36).substr(2, 9);

            // --- SIGNATURE & STATUS LOGIC ---
            let initialStatus = 'DRAFT';
            if (data.signatures && data.signatures.studentImg) {
                initialStatus = 'SUBMITTED';
                const now = new Date().toISOString();

                const getIp = (req: Request) => {
                    const ip = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
                    return ip === '::1' ? '127.0.0.1 (Localhost)' : ip;
                };

                const dynamicCode = Math.random().toString(36).substring(2, 10).toUpperCase();
                const signatureHashInput = `${conventionsId}:student:${now}:${dynamicCode}`;
                const dynamicHash = crypto.createHash('sha256').update(signatureHashInput).digest('hex');

                const studentSig = {
                    signedAt: now,
                    img: data.signatures.studentImg,
                    code: dynamicCode,
                    hash: dynamicHash,
                    ip: getIp(req),
                };

                data.signatures.student = studentSig;
                const actorEmail = data.eleve_email || session?.user?.email || 'student';
                data.auditLogs = [
                    {
                        date: now,
                        action: 'SIGNED',
                        actorEmail: actorEmail,
                        details: 'Signature Élève/Étudiant',
                        ip: studentSig.ip
                    }
                ];

                delete data.signatures.studentImg;
                delete data.signatures.studentAt;
            }

            // --- USER PROVISIONING ---
            const provisioningResults: Record<string, string> = {};

            if (data.est_mineur && data.rep_legal_email) {
                const parentRes = await findOrCreateUser({
                    pool,
                    email: data.rep_legal_email,
                    role: 'parent',
                    firstName: data.rep_legal_prenom || '',
                    lastName: data.rep_legal_nom || '',
                    phone: data.rep_legal_tel,
                    studentName: `${data.eleve_prenom} ${data.eleve_nom}`
                });
                if (parentRes.uid) provisioningResults.parentUid = parentRes.uid;
            }

            if (data.tuteur_email) {
                const tutorRes = await findOrCreateUser({
                    pool,
                    email: data.tuteur_email,
                    role: 'tutor',
                    firstName: (data.tuteur_prenom || data.tuteur_nom || '').split(' ')[0],
                    lastName: data.tuteur_nom || '',
                    phone: data.tuteur_tel,
                    studentName: `${data.eleve_prenom} ${data.eleve_nom}`
                });
                if (tutorRes.uid) provisioningResults.tutorUid = tutorRes.uid;
            }

            if (data.ent_rep_email) {
                const headRes = await findOrCreateUser({
                    pool,
                    email: data.ent_rep_email,
                    role: 'company_head',
                    firstName: (data.ent_rep_prenom || data.ent_rep_nom || '').split(' ')[0],
                    lastName: data.ent_rep_nom || '',
                    phone: data.ent_rep_tel,
                    studentName: `${data.eleve_prenom} ${data.eleve_nom}`
                });
                if (headRes.uid) provisioningResults.companyHeadUid = headRes.uid;
            }

            data.linked_uids = provisioningResults;
            if (provisioningResults.parentUid) data.rep_legal_uid = provisioningResults.parentUid;
            if (provisioningResults.tutorUid) data.tutor_uid = provisioningResults.tutorUid;
            if (provisioningResults.companyHeadUid) data.signataire_uid = provisioningResults.companyHeadUid;

            // --- DB INSERTION ---
            await client.query('BEGIN');

            // --- 0. Company UPSERT (Foreign Key Guard) ---
            const rawSiret = data.ent_siret || data.metadata?.ent_siret || '';
            const cleanSiret = rawSiret.toString().replace(/\D/g, '').substring(0, 14);

            if (cleanSiret && cleanSiret.length === 14) {
                await client.query(`
                    INSERT INTO companies (siret, name, address, postal_code, city, phone)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (siret) DO UPDATE 
                    SET 
                        name = EXCLUDED.name, 
                        address = EXCLUDED.address, 
                        postal_code = EXCLUDED.postal_code, 
                        city = EXCLUDED.city,
                        phone = COALESCE(EXCLUDED.phone, companies.phone)
                 `, [
                    cleanSiret,
                    data.ent_nom || 'Entreprise Inconnue',
                    data.ent_adresse || '',
                    data.ent_code_postal || null,
                    data.ent_ville || null,
                    data.tuteur_tel || data.ent_rep_tel || null
                ]);
            }


            const query = `
                INSERT INTO conventions (
                    id, 
                    student_uid, 
                    status, 
                    created_at, 
                    updated_at,
                    metadata,
                    date_start,
                    date_end,
                    establishment_uai,
                    is_out_of_period,
                    class_id,
                    duration_hours,
                    company_siret,
                    type
                ) VALUES ($1, $2, $3, NOW(), NOW(), $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING id, student_uid, status, metadata, date_start, date_end, establishment_uai, class_id, duration_hours, company_siret, created_at, type
            `;

            const result = await client.query(query, [
                conventionsId,
                studentId || (session.user as any).id,
                initialStatus,
                JSON.stringify(data),
                data.dateStart || data.stage_date_debut,
                data.dateEnd || data.stage_date_fin,
                uai,
                data.is_out_of_period || false,
                classId || (typeof data.eleve_classe === 'string' && data.eleve_classe.startsWith('cls_') ? data.eleve_classe : null),
                data.stage_duree_heures || 0,
                cleanSiret || null,
                data.type || 'PFMP_STANDARD'
            ]);

            // --- AUTO-ALIMENTATION DES PARTENAIRES ---
            if (cleanSiret && uai) {
                try {
                    let lat = null;
                    let lng = null;
                    let city = '';
                    let postalCode = '';
                    let finalAddress = data.ent_adresse || '';
                    let finalName = data.ent_nom || 'Entreprise inconnue';

                    const gouvInfo = await getCompanyInfoBySiret(cleanSiret);
                    if (gouvInfo) {
                        lat = gouvInfo.lat;
                        lng = gouvInfo.lng;
                        city = gouvInfo.city;
                        postalCode = gouvInfo.postalCode;
                        if (gouvInfo.address) finalAddress = gouvInfo.address;
                        if (gouvInfo.name) finalName = gouvInfo.name;
                    }

                    // FALLBACK: If we still don't have valid GPS, use the address-based geocoding
                    if ((!lat || !lng) && data.ent_adresse) {
                        const coords = await getCoordinates(data.ent_adresse);
                        if (coords) {
                            lat = coords.lat;
                            lng = coords.lon;
                        }
                    }

                    const partnerQuery = `
                        INSERT INTO partners (
                            school_id, 
                            siret, 
                            name, 
                            address,
                            city,
                            postal_code,
                            latitude, 
                            longitude,
                            classes
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
                        ON CONFLICT (siret) DO UPDATE SET
                            name = EXCLUDED.name,
                            address = EXCLUDED.address,
                            city = COALESCE(EXCLUDED.city, partners.city),
                            postal_code = COALESCE(EXCLUDED.postal_code, partners.postal_code),
                            latitude = COALESCE(EXCLUDED.latitude, partners.latitude),
                            longitude = COALESCE(EXCLUDED.longitude, partners.longitude),
                            classes = (
                                SELECT jsonb_agg(DISTINCT elem)
                                FROM jsonb_array_elements(partners.classes || EXCLUDED.classes) elem
                            )
                    `;

                    const classArray = data.eleve_classe ? JSON.stringify([data.eleve_classe]) : '[]';
                    await client.query(partnerQuery, [
                        uai,
                        cleanSiret,
                        finalName,
                        finalAddress,
                        city,
                        postalCode,
                        lat,
                        lng,
                        classArray
                    ]);
                } catch (partnerError) {
                    console.error("[AUTO-PARTNER] Error updating partner table:", partnerError);
                }
            }

            await client.query('COMMIT');

            // --- EMAIL & NOTIFICATION LOGIC ---
            if (initialStatus === 'SUBMITTED' && data.signatures && (data.signatures.student || data.signatures.studentImg)) {
                if (data.eleve_email) {
                    await safeSendEmail({
                        to: data.eleve_email,
                        subject: `Confirmation de signature`,
                        text: `Bonjour ${data.eleve_prenom || 'Elève'},\n\n` +
                            `Vous avez signé votre convention.\n` +
                            `Nous avons envoyé une demande de validation à votre représentant légal (${data.rep_legal_email}).\n\n` +
                            `Cordialement,\nL'équipe Pledgeum`
                    });
                }

                if (data.est_mineur && data.rep_legal_email) {
                    const parentEmail = data.rep_legal_email.toLowerCase().trim();
                    const nRes = await safeSendEmail({
                        to: parentEmail,
                        subject: `Action requise - Convention de stage de ${data.eleve_prenom}`,
                        text: `Bonjour,\n\n` +
                            `Votre enfant ${data.eleve_prenom} ${data.eleve_nom} a signé sa convention de stage.\n` +
                            `En tant que représentant légal, votre signature est maintenant requise pour valider le document.\n\n` +
                            `Connectez-vous à votre espace Pledgeum pour signer : ${process.env.NEXT_PUBLIC_APP_URL || 'https://www.pledgeum.fr'}/login\n\n` +
                            `Cordialement,\nL'équipe Pledgeum`
                    });
                    if (nRes) emailWarning = nRes;
                }
            }

            const createdConvention = result.rows[0];
            return NextResponse.json({
                success: true,
                data: createdConvention,
                warning: emailWarning?.type,
                debugError: emailWarning?.detail
            });

        } catch (dbError: any) {
            if (client) await client.query('ROLLBACK');
            throw dbError;
        } finally {
            if (client) client.release();
        }

    } catch (error: any) {
        console.error('Create Convention Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
