
import { NextResponse } from 'next/server';
import pool from '@/lib/pg';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const rawCode = searchParams.get('code') || '';
    const cleanCode = rawCode.trim();

    if (!cleanCode) {
        return NextResponse.json({ error: 'Code manquant' }, { status: 400 });
    }

    try {
        const isMissionOrder = cleanCode.toUpperCase().startsWith('ODM');
        const isAttestation = cleanCode.toUpperCase().startsWith('ATT');

        if (isMissionOrder) {
            // Bloc dédié aux Ordres de Mission
            // ... (keep existing mo code)
            const moQuery = `
                SELECT 
                    m.id, 
                    m.status, 
                    m.signature_data, 
                    m.pdf_hash,
                    m.created_at, 
                    m.updated_at,
                    m.teacher_email,
                    c.id as convention_id, 
                    c.metadata, 
                    c.date_start, 
                    c.date_end, 
                    (c.metadata->>'eleve_prenom') as student_first_name,
                    (c.metadata->>'eleve_nom') as student_last_name,
                    (c.metadata->>'ent_nom') as company_name,
                    (c.metadata->>'ent_ville') as company_city,
                    tu.first_name AS teacher_first_name, 
                    tu.last_name AS teacher_last_name
                FROM mission_orders m
                JOIN conventions c ON m.convention_id = c.id
                LEFT JOIN users tu ON m.teacher_email = tu.email
                WHERE (
                    m.id::text ILIKE $1
                    OR REPLACE(m.id::text, '-', '') ILIKE REPLACE($1, '-', '')
                    OR REPLACE(m.signature_data->'teacher'->>'hash', '-', '') ILIKE REPLACE($1, '-', '')
                    OR REPLACE(m.signature_data->'head'->>'hash', '-', '') ILIKE REPLACE($1, '-', '')
                    OR REPLACE(m.signature_data->>'hash', '-', '') ILIKE REPLACE($1, '-', '')
                    OR REPLACE(m.pdf_hash, '-', '') ILIKE REPLACE(REPLACE($1, 'ODM-', ''), '-', '')
                    OR ('ODM-' || REPLACE(m.pdf_hash, '-', '')) ILIKE REPLACE($1, '-', '')
                )
                LIMIT 1
            `;
            const moRes = await pool.query(moQuery, [cleanCode]);

            if (moRes?.rowCount && moRes.rowCount > 0) {
                const mo = moRes.rows[0];
                const rawMetadata = mo.metadata || {};

                const signatures: Record<string, any> = {};
                if (mo.signature_data?.teacher?.date) {
                    signatures.teacher = { ...mo.signature_data.teacher, signedAt: mo.signature_data.teacher.date, code: mo.signature_data.teacher.hash };
                }
                if (mo.signature_data?.head?.date || mo.signature_data?.date) {
                    signatures.head = {
                        ...(mo.signature_data?.head || mo.signature_data),
                        signedAt: mo.signature_data?.head?.date || mo.signature_data?.date,
                        code: mo.signature_data?.head?.hash || mo.signature_data?.hash
                    };
                }

                const mappedDocument = {
                    ...mo,
                    id: mo.id,
                    conventionId: mo.convention_id,
                    status: mo.status,
                    type: 'mission_order',
                    createdAt: mo.created_at,
                    updatedAt: mo.updated_at,
                    dateStart: mo.date_start || rawMetadata.stage_date_debut,
                    dateEnd: mo.date_end || rawMetadata.stage_date_fin,
                    signatures,
                    student_first_name: mo.student_first_name,
                    student_last_name: mo.student_last_name,
                    teacher_first_name: mo.teacher_first_name,
                    teacher_last_name: mo.teacher_last_name
                };

                return NextResponse.json({
                    success: true,
                    isValid: true,
                    type: 'mission_order',
                    convention: mappedDocument,
                    document: mappedDocument
                });
            }

            return NextResponse.json({ error: 'Ordre de Mission non trouvé' }, { status: 404 });
        } else if (isAttestation) {
            // Bloc dédié aux Attestations PFMP
            const attQuery = `
                SELECT 
                    a.id, 
                    a.convention_id,
                    a.signature_date,
                    a.signature_code,
                    a.pdf_hash,
                    a.created_at,
                    c.metadata,
                    c.date_start,
                    c.date_end,
                    (c.metadata->>'eleve_prenom') as student_first_name,
                    (c.metadata->>'eleve_nom') as student_last_name,
                    (c.metadata->>'ent_nom') as company_name,
                    (c.metadata->>'ent_ville') as company_city
                FROM attestations a
                JOIN conventions c ON a.convention_id = c.id
                WHERE (
                    a.signature_code ILIKE $1
                    OR REPLACE(a.signature_code, '-', '') ILIKE REPLACE($1, '-', '')
                    OR REPLACE(a.pdf_hash, '-', '') ILIKE REPLACE(REPLACE($1, 'ATT-', ''), '-', '')
                    OR ('ATT-' || REPLACE(a.pdf_hash, '-', '')) ILIKE REPLACE($1, '-', '')
                )
                LIMIT 1
            `;
            const attRes = await pool.query(attQuery, [cleanCode]);

            if (attRes?.rowCount && attRes.rowCount > 0) {
                const att = attRes.rows[0];
                const rawMetadata = att.metadata || {};

                const mappedDocument = {
                    ...att,
                    id: att.id,
                    conventionId: att.convention_id,
                    type: 'attestation',
                    status: 'SIGNED',
                    createdAt: att.created_at,
                    updatedAt: att.signature_date,
                    dateStart: att.date_start || rawMetadata.stage_date_debut,
                    dateEnd: att.date_end || rawMetadata.stage_date_fin,
                    student_first_name: att.student_first_name,
                    student_last_name: att.student_last_name,
                    company_name: att.company_name,
                    company_city: att.company_city,
                    signature_code: att.signature_code
                };

                return NextResponse.json({
                    success: true,
                    isValid: true,
                    type: 'attestation',
                    convention: mappedDocument,
                    document: mappedDocument
                });
            }

            return NextResponse.json({ error: 'Attestation non trouvée' }, { status: 404 });
        } else {
            // Bloc dédié aux Conventions classiques
            const query = `
                SELECT id, status, created_at, updated_at, date_start, date_end, metadata 
                FROM conventions c
                WHERE (
                    id::text ILIKE $1 || '%' 
                    OR REPLACE(id::text, '-', '') ILIKE REPLACE($1, '-', '') || '%'
                    OR REPLACE(REPLACE(id::text, 'conv_', ''), '-', '') ILIKE REPLACE($1, '-', '') || '%'
                )
                OR pdf_hash ILIKE $1 || '%'
                OR EXISTS (
                    SELECT 1 FROM jsonb_each_text(COALESCE(metadata, '{}'::jsonb)) AS m(k, v)
                    WHERE v ILIKE $1 || '%' OR REPLACE(v, '-', '') ILIKE REPLACE($1, '-', '') || '%'
                )
                OR EXISTS (
                    SELECT 1 FROM jsonb_each(COALESCE(metadata->'signatures', '{}'::jsonb)) AS sig(role, data)
                    WHERE (
                        CASE 
                            WHEN jsonb_typeof(data) = 'object' THEN 
                                data->>'code' ILIKE $1 || '%' 
                                OR data->>'hash' ILIKE $1 || '%'
                                OR REPLACE(data->>'code', '-', '') ILIKE REPLACE($1, '-', '') || '%'
                                OR REPLACE(data->>'hash', '-', '') ILIKE REPLACE($1, '-', '') || '%'
                            WHEN jsonb_typeof(data) = 'string' THEN 
                                data #>> '{}' ILIKE $1 || '%'
                                OR REPLACE(data #>> '{}', '-', '') ILIKE REPLACE($1, '-', '') || '%'
                            ELSE false
                        END
                    )
                )
                OR (
                    jsonb_typeof(metadata->'signatures') = 'array' AND EXISTS (
                        SELECT 1 FROM jsonb_array_elements(metadata->'signatures') AS sig_arr
                        WHERE 
                            sig_arr->>'code' ILIKE $1 || '%' 
                            OR sig_arr->>'hash' ILIKE $1 || '%'
                            OR REPLACE(sig_arr->>'code', '-', '') ILIKE REPLACE($1, '-', '') || '%'
                            OR REPLACE(sig_arr->>'hash', '-', '') ILIKE REPLACE($1, '-', '') || '%'
                    )
                )
                LIMIT 1
            `;

            const res = await pool.query(query, [cleanCode]);

            if (!res?.rowCount || res.rowCount === 0) {
                return NextResponse.json({ error: 'Convention non trouvée' }, { status: 404 });
            }

            const convention = res.rows[0];
            const rawMetadata = convention.metadata || {};

            const mappedConvention = {
                ...convention,
                ...rawMetadata,
                metadata: rawMetadata,
                id: convention.id,
                status: convention.status,
                type: rawMetadata.type || (convention as any).type,
                createdAt: convention.created_at,
                updatedAt: convention.updated_at,
                dateStart: convention.date_start || rawMetadata.stage_date_debut,
                dateEnd: convention.date_end || rawMetadata.stage_date_fin,
                signatures: rawMetadata.signatures || {}
            };

            return NextResponse.json({ success: true, convention: mappedConvention });
        }
    } catch (error) {
        console.error('Verification API error:', error);
        return NextResponse.json({ error: 'Erreur serveur lors de la vérification' }, { status: 500 });
    }
}
