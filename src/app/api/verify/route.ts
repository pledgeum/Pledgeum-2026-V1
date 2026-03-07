
import { NextResponse } from 'next/server';
import pool from '@/lib/pg';
import fs from 'fs';
import path from 'path';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const rawCode = searchParams.get('code') || '';
    const code = rawCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase().trim();

    if (!code) {
        return NextResponse.json({ error: 'Code manquant' }, { status: 400 });
    }


    try {
        const query = `
            SELECT id, status, created_at, updated_at, date_start, date_end, metadata 
            FROM conventions c
            WHERE (
                id::text ILIKE $1 || '%' 
                OR REPLACE(id::text, '-', '') ILIKE $1 || '%'
                OR REPLACE(REPLACE(id::text, 'conv_', ''), '-', '') ILIKE $1 || '%'
            )
            OR pdf_hash ILIKE $2 || '%'
            OR EXISTS (
                SELECT 1 FROM jsonb_each_text(COALESCE(metadata, '{}'::jsonb)) AS m(k, v)
                WHERE v ILIKE $2 || '%' OR REPLACE(v, '-', '') ILIKE $2 || '%'
            )
            OR EXISTS (
                SELECT 1 FROM jsonb_each(COALESCE(metadata->'signatures', '{}'::jsonb)) AS sig(role, data)
                WHERE (
                    CASE 
                        WHEN jsonb_typeof(data) = 'object' THEN data->>'code' ILIKE $2 || '%' OR data->>'hash' ILIKE $2 || '%'
                        WHEN jsonb_typeof(data) = 'string' THEN data #>> '{}' ILIKE $2 || '%'
                        ELSE false
                    END
                )
            )
            OR (
                jsonb_typeof(metadata->'signatures') = 'array' AND EXISTS (
                    SELECT 1 FROM jsonb_array_elements(metadata->'signatures') AS sig_arr
                    WHERE sig_arr->>'code' ILIKE $2 || '%' OR sig_arr->>'hash' ILIKE $2 || '%'
                )
            )
            LIMIT 1
        `;

        const values = [code, code];
        const res = await pool.query(query, values);

        if (res.rowCount === 0) {
            return NextResponse.json({ error: 'Document non trouvé' }, { status: 404 });
        }

        const convention = res.rows[0];

        const rawMetadata = convention.metadata || {};

        // Return full metadata and root fields to allow full PDF rendering and name resolution
        // While keeping it within the 'convention' object format expected by the frontend
        const mappedConvention = {
            ...convention,
            ...rawMetadata,
            metadata: rawMetadata, // Keep original metadata object for components that expect it
            id: convention.id,
            status: convention.status,
            type: rawMetadata.type || convention.type,
            createdAt: convention.created_at,
            updatedAt: convention.updated_at,
            dateStart: convention.date_start || rawMetadata.stage_date_debut,
            dateEnd: convention.date_end || rawMetadata.stage_date_fin,
            signatures: rawMetadata.signatures || {}
        };

        return NextResponse.json({ success: true, convention: mappedConvention });
    } catch (error) {
        console.error('Verification API error:', error);
        return NextResponse.json({ error: 'Erreur serveur lors de la vérification' }, { status: 500 });
    }
}
