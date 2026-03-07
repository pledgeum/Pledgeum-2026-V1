
import pool from '../lib/pg';

async function debug() {
    try {
        console.log("Checking last 10 conventions...");
        const res = await pool.query(`
            SELECT id, status, pdf_hash, 
            metadata->>'attestation_signature_code' as sig_code,
            metadata->>'certificateHash' as cert_hash,
            metadata->'signatures'->'head'->>'code' as head_code,
            metadata->'signatures'->'head'->>'hash' as head_hash
            FROM conventions 
            ORDER BY updated_at DESC 
            LIMIT 10
        `);
        console.table(res.rows);

        console.log("\nSearching for code like '9A0%':");
        const res2 = await pool.query(`
            SELECT id, status, pdf_hash, metadata->>'certificateHash' as cert_hash
            FROM conventions 
            WHERE id::text ILIKE '9A0%'
            OR pdf_hash ILIKE '9A0%'
            OR metadata::text ILIKE '%9A0%'
        `);
        console.table(res2.rows);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

debug();
