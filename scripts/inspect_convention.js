
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function check() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL
    });

    try {
        const conventionId = 'conv_5zm0iqbqo';
        console.log(`🔍 Inspection de la convention ${conventionId}...`);

        const res = await pool.query(`SELECT status, metadata FROM conventions WHERE id = $1`, [conventionId]);

        if (res.rowCount > 0) {
            const conv = res.rows[0];
            console.log("Statut Global:", conv.status);
            console.log("Signatures dans Metadata:", JSON.stringify(conv.metadata.signatures, null, 2));
            console.log("Audit Logs dans Metadata:", JSON.stringify(conv.metadata.auditLogs, null, 2));
        } else {
            console.log("❌ Convention non trouvée.");
        }

    } catch (err) {
        console.error("❌ Erreur :", err);
    } finally {
        await pool.end();
    }
}

check();
