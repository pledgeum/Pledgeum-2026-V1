import { NextResponse } from 'next/server';
import pool from '@/lib/pg';
import { auth } from '@/auth';
import { pdf } from '@react-pdf/renderer';
import { AttestationPdf } from '@/components/pdf/AttestationPdf';
import { generateVerificationUrl } from '@/app/actions/sign';
import QRCode from 'qrcode';
import React from 'react';

export const dynamic = 'force-dynamic';

export async function GET(
    req: Request, 
    props: { params: Promise<{ id: string }> }
) {
    let client;
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const params = await props.params;
        const { id } = params; // This is the convention ID

        client = await pool.connect();

        // 1. Fetch user role and identity
        const userRes = await client.query(
            'SELECT uid, role, establishment_uai FROM users WHERE email = $1',
            [session.user.email.toLowerCase().trim()]
        );
        const dbUser = userRes.rows[0];
        if (!dbUser) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const userId = dbUser.uid;
        const userRole = dbUser.role;
        const userUai = dbUser.establishment_uai;
        const userEmail = session.user.email.toLowerCase().trim();

        // 2. Fetch full convention data with attestation and school details
        const query = `
            SELECT 
                c.*,
                c.metadata as convention_metadata,
                cl.name as class_name,
                cl.main_teacher_id,
                cl.establishment_uai as class_establishment_uai,
                est.name as school_name,
                est.address as school_address,
                est.postal_code as school_zip,
                est.city as school_city,
                est.admin_name as school_head_name,
                att.total_days_paid,
                att.total_weeks_diploma,
                att.absences_hours as attestation_absences_hours,
                att.activities as attestation_activities,
                att.skills_evaluation as attestation_skills,
                att.gratification_amount as attestation_gratification_amount,
                att.signer_name as att_signer_name,
                att.signer_function as att_signer_function,
                att.signature_date as att_signature_date,
                att.signature_img as att_signature_img,
                att.signature_code as att_signature_code,
                att.pdf_hash as att_pdf_hash,
                att.audit_logs as att_audit_logs
            FROM conventions c
            JOIN classes cl ON c.class_id = cl.id
            LEFT JOIN establishments est ON c.establishment_uai = est.uai
            LEFT JOIN attestations att ON c.id = att.convention_id
            WHERE c.id = $1;
        `;
        const res = await client.query(query, [id]);

        if (res.rowCount === 0) {
            return NextResponse.json({ error: "Convention non trouvée" }, { status: 404 });
        }

        const row = res.rows[0];

        // 3. Security Check (IDOR Protection)
        let hasAccess = false;
        const staffRoles = ['school_head', 'ddfpt', 'at_ddfpt', 'admin'];
        const companyRoles = ['tutor', 'company_head', 'company_head_tutor'];

        if (userRole === 'SUPER_ADMIN') {
            hasAccess = true;
        } else if (staffRoles.includes(userRole)) {
            hasAccess = row.establishment_uai === userUai;
        } else if (userRole === 'teacher') {
            // Teacher access: Principal of the class OR assigned in teacher_assignments
            if (row.main_teacher_id === userId) {
                hasAccess = true;
            } else {
                const assignRes = await client.query(
                    'SELECT 1 FROM teacher_assignments WHERE teacher_uid = $1 AND class_id = $2',
                    [userId, row.class_id]
                );
                hasAccess = assignRes.rowCount > 0;
            }
        } else if (userRole === 'student') {
            hasAccess = row.student_uid === userId;
        } else if (companyRoles.includes(userRole)) {
            const tutorEmail = (row.metadata?.tuteur_email || row.tutor_email || '').toLowerCase();
            const entRepEmail = (row.metadata?.ent_rep_email || '').toLowerCase();
            hasAccess = tutorEmail === userEmail || entRepEmail === userEmail;
        }

        if (!hasAccess) {
            return NextResponse.json({ error: "Forbidden: Access Denied" }, { status: 403 });
        }

        if (!row.att_signature_date) {
            return NextResponse.json({ error: "L'attestation n'est pas encore signée" }, { status: 400 });
        }

        // 4. Hydrate Convention object for AttestationPdf
        // Mapping DB fields to the expected Convention interface
        const convention = {
            id: row.id,
            eleve_nom: row.eleve_nom,
            eleve_prenom: row.eleve_prenom,
            eleve_classe: row.class_name,
            eleve_date_naissance: row.eleve_date_naissance,
            ecole_nom: row.school_name || row.ecole_nom,
            ecole_adresse: row.school_address || row.ecole_adresse,
            ecole_chef_nom: row.school_head_name || row.ecole_chef_nom,
            ent_nom: row.ent_nom,
            ent_siret: row.ent_siret,
            ent_adresse: row.ent_adresse,
            ent_rep_nom: row.ent_rep_nom,
            ent_rep_fonction: row.ent_rep_fonction,
            ent_rep_email: row.ent_rep_email,
            ent_ville: row.ent_ville,
            stage_date_debut: row.date_start,
            stage_date_fin: row.date_end,
            stage_duree_heures: row.duration_hours,
            attestation_total_jours: row.total_days_paid,
            attestation_total_semaines: row.total_weeks_diploma,
            attestation_absences_hours: row.attestation_absences_hours,
            activites: row.attestation_activities || row.activites,
            attestation_competences: row.attestation_skills,
            attestation_gratification: row.attestation_gratification_amount,
            attestation_signer_name: row.att_signer_name,
            attestation_signer_function: row.att_signer_function,
            attestationSigned: true,
            attestationDate: row.att_signature_date,
            attestation_signature_img: row.att_signature_img,
            attestation_signature_code: row.att_signature_code,
            absences: [], // Full absence list could be fetched if needed
            auditLogs: row.att_audit_logs || [],
            ...row.convention_metadata
        };

        // 5. Generate QR and Hash
        const { url, hashDisplay } = await generateVerificationUrl(convention as any, 'attestation');
        const qrCodeUrl = await QRCode.toDataURL(url);

        // 6. Render PDF
        const buffer = await (pdf(
            React.createElement(AttestationPdf, {
                convention: convention as any,
                totalAbsenceHours: row.attestation_absences_hours || 0,
                qrCodeUrl,
                hashCode: hashDisplay
            }) as any
        ).toBuffer() as unknown as Promise<Buffer>);

        return new Response(buffer as any, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="Attestation_${row.eleve_nom}_${row.id}.pdf"`,
            },
        });

    } catch (error: any) {
        console.error("[API_ATTESTATION_PDF] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
        if (client) client.release();
    }
}
