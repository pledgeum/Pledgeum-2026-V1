require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT id, metadata->>'eleve_prenom' as prenom, metadata->>'eleve_nom' as nom, metadata->>'est_mineur' as est_mineur 
            FROM conventions 
            WHERE metadata->>'eleve_nom' ILIKE '%BERTHOU%'
        `);
        console.log(`Found ${res.rowCount} conventions for BERTHOU`);
        
        for (const row of res.rows) {
            try {
                await client.query(`
                SELECT 
                    metadata->>'eleve_prenom' AS eleve_prenom, 
                    metadata->>'eleve_nom' AS eleve_nom, 
                    (metadata->>'est_mineur')::boolean AS est_mineur 
                FROM conventions 
                WHERE id = $1
                `, [row.id]);
            } catch(e) {
                console.error(`FAIL cast on ${row.id}: ${e.message} (est_mineur="${row.est_mineur}")`);
            }
        }
    } finally {
        client.release();
        pool.end();
    }
}
run();
