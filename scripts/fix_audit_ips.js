
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function fixAuditIps() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL
    });

    try {
        console.log("🔍 Recherche de conventions avec l'IP '::1'...");

        const res = await pool.query(`
            SELECT id, metadata 
            FROM conventions 
            WHERE metadata::text LIKE '%"::1"%'
        `);

        let repairCount = 0;

        for (const row of res.rows) {
            const { id, metadata } = row;
            let modified = false;

            // 1. Fix auditLogs
            if (Array.isArray(metadata.auditLogs)) {
                metadata.auditLogs = metadata.auditLogs.map(log => {
                    if (log.ip === '::1') {
                        modified = true;
                        return { ...log, ip: '127.0.0.1 (Localhost)' };
                    }
                    return log;
                });
            }

            // 2. Fix signature blocks (optional but deeply cleans data)
            if (metadata.signatures && typeof metadata.signatures === 'object') {
                for (const role of Object.keys(metadata.signatures)) {
                    const sig = metadata.signatures[role];
                    if (sig && typeof sig === 'object' && sig.ip === '::1') {
                        sig.ip = '127.0.0.1 (Localhost)';
                        modified = true;
                    }
                }
            }

            if (modified) {
                console.log(`🔧 Correction des IP(s) ::1 pour la convention ${id}...`);

                await pool.query(`
                    UPDATE conventions 
                    SET metadata = $1::jsonb
                    WHERE id = $2
                `, [JSON.stringify(metadata), id]);

                repairCount++;
                console.log(`✅ Convention ${id} IP corrigée.`);
            }
        }

        console.log(`\n🎉 Travail terminé. Total corrigé : ${repairCount}`);

    } catch (err) {
        console.error("❌ Erreur :", err);
    } finally {
        await pool.end();
    }
}

fixAuditIps();
