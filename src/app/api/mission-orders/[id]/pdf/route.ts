import { NextResponse } from 'next/server';
import pool from '@/lib/pg';
import { generateVerificationUrl } from '@/app/actions/sign';
import QRCode from 'qrcode';
import { pdf } from '@react-pdf/renderer';
import { MissionOrderPdf } from '@/components/pdf/MissionOrderPdf';
import React from 'react';

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const { id } = params;

    try {
        // 1. Fetch Mission Order and its Convention with full hydration
        // We join with students (identity), visits (teacher info), and schools
        const query = `
            SELECT 
                m.*, 
                c.metadata as convention_metadata, 
                c.date_start, 
                c.date_end,
                c.eleve_nom,
                c.eleve_prenom,
                c.eleve_classe,
                c.ecole_nom,
                c.ecole_adresse,
                c.ent_nom,
                c.ent_adresse,
                c.ent_code_postal,
                c.ent_ville,
                c.ent_siret,
                v.tracking_teacher_email,
                tu.first_name as teacher_first_name,
                tu.last_name as teacher_last_name,
                s.address as school_detail_address,
                s.postal_code as school_detail_zip,
                s.city as school_detail_city
            FROM mission_orders m
            JOIN conventions c ON m.convention_id = c.id
            LEFT JOIN visits v ON m.convention_id = v.convention_id
            LEFT JOIN users tu ON v.tracking_teacher_email = tu.email
            LEFT JOIN establishments s ON c.ecole_nom = s.name
            WHERE m.id = $1
        `;
        const res = await pool.query(query, [id]);

        if (!res.rowCount || res.rowCount === 0) {
            return NextResponse.json({ error: 'Ordre de Mission non trouvé' }, { status: 404 });
        }

        const rawOdm = res.rows[0];
        
        // Map raw DB record to MissionOrder interface
        const odm = {
            id: rawOdm.id,
            conventionId: rawOdm.convention_id,
            teacherId: rawOdm.teacher_email,
            studentId: rawOdm.student_id,
            schoolAddress: rawOdm.school_address,
            companyAddress: rawOdm.company_address,
            distanceKm: parseFloat(rawOdm.distance_km || '0'),
            status: rawOdm.status,
            signature_data: rawOdm.signature_data,
            createdAt: rawOdm.created_at
        };

        console.log('[ODM_PDF_DEBUG] Mission Order hydrated:', {
            id: odm.id,
            teacherId: odm.teacherId,
            school: rawOdm.school_detail_address,
            hasMetadata: !!rawOdm.convention_metadata
        });

        // Construct the expected Convention object for MissionOrderPdf props
        const convention = {
            id: odm.conventionId,
            eleve_nom: rawOdm.eleve_nom,
            eleve_prenom: rawOdm.eleve_prenom,
            eleve_classe: rawOdm.eleve_classe,
            ecole_nom: rawOdm.ecole_nom,
            ecole_adresse: rawOdm.ecole_adresse,
            ent_nom: rawOdm.ent_nom,
            ent_adresse: rawOdm.ent_adresse,
            ent_code_postal: rawOdm.ent_code_postal,
            ent_ville: rawOdm.ent_ville,
            stage_date_debut: rawOdm.date_start,
            stage_date_fin: rawOdm.date_end,
            visit: {
                tracking_teacher_email: rawOdm.tracking_teacher_email,
                tracking_teacher_first_name: rawOdm.teacher_first_name,
                tracking_teacher_last_name: rawOdm.teacher_last_name
            },
            school: {
                address: rawOdm.school_detail_address,
                zipCode: rawOdm.school_detail_zip,
                city: rawOdm.school_detail_city
            },
            signatures: rawOdm.convention_metadata?.signatures || {},
            ...rawOdm.convention_metadata
        };

        // 2. Generate Brand Fresh QR and Hash (Sync with Document logic)
        const { url, hashDisplay } = await generateVerificationUrl(convention as any, 'mission_order');
        const qrCodeUrl = await QRCode.toDataURL(url);

        // 3. Render PDF to Buffer for server-side response
        const buffer = await (pdf(
            React.createElement(MissionOrderPdf, {
                missionOrder: odm,
                convention: convention as any,
                qrCodeUrl,
                hashCode: hashDisplay
            }) as any
        ).toBuffer() as unknown as Promise<Buffer>);

        return new Response(buffer as any, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="ODM_${id}.pdf"`,
            },
        });

    } catch (error: any) {
        console.error('Error generating ODM PDF:', {
            message: error.message,
            stack: error.stack,
            id: id
        });
        return NextResponse.json({ 
            error: 'Erreur lors de la génération du PDF',
            details: error.message 
        }, { status: 500 });
    }
}
