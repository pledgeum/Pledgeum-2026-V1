
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function find() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL
    });

    try {
        const search = '56F7059AC451';
        console.log(`🔍 Recherche de la référence ${search}...`);

        // Search in ID, pdf_hash, or metadata
        const res = await pool.query(`
            SELECT id, status, pdf_hash, metadata 
            FROM conventions 
            WHERE id ILIKE $1 
               OR pdf_hash ILIKE $1 
               OR metadata::text ILIKE $1
        `, [`%${search}%`]);

        if (res.rowCount > 0) {
            console.log(`✅ Trouvé ${res.rowCount} correspondance(s).`);
            res.rows.forEach(row => {
                console.log("-----------------------------------------");
                console.log("ID:", row.id);
                console.log("Statut:", row.status);
                console.log("PDF Hash:", row.pdf_hash);
                console.log("Audit Logs Count:", row.metadata?.auditLogs?.length || 0);
                console.log("Audit Logs:", JSON.stringify(row.metadata?.auditLogs, null, 2));
                console.log("Signatures keys:", Object.keys(row.metadata?.signatures || {}));
            });
        } else {
            console.log("❌ Aucune convention trouvée avec cette référence.");

            // Try to find the convention by the emails mentioned in the user's log
            const res2 = await pool.query(`
                SELECT id, status, pdf_hash, metadata 
                FROM conventions 
                WHERE metadata::text ILIKE '%fabrice.dumasdelage@icloud.com%'
                AND metadata::text ILIKE '%fabrice.dumasdelage@gmail.com%'
                ORDER BY updated_at DESC LIMIT 1
            `);
            if (res2.rowCount > 0) {
                console.log("🔍 Convention probable trouvée par email :");
                console.log("ID:", res2.rows[0].id);
                console.log("Reference:", res2.rows[0].pdf_hash);
                console.log("Audit Logs:", JSON.stringify(res2.rows[0].metadata?.auditLogs, null, 2));
            }
        }

    } catch (err) {
        console.error("❌ Erreur :", err);
    } finally {
        await pool.end();
    }
}

find();
