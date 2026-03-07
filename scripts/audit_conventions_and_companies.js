const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function main() {
    try {
        const checkRes = await pool.query('SELECT COUNT(*) FROM conventions');
        console.log("Total conventions en base de données :", checkRes.rows[0].count);

        const latestRes = await pool.query('SELECT id, created_at, status FROM conventions ORDER BY created_at DESC LIMIT 5');
        console.log("Les 5 plus récentes :");
        latestRes.rows.forEach(r => console.log(`- ${r.id} | Créée le: ${r.created_at} | Status: ${r.status}`));

        const compRes = await pool.query(`
            SELECT metadata->>'ent_nom' as ent_nom, count(*) as count 
            FROM conventions 
            WHERE metadata->>'ent_nom' IS NOT NULL AND metadata->>'ent_nom' != ''
            GROUP BY metadata->>'ent_nom' 
            ORDER BY metadata->>'ent_nom' ASC;
        `);
        console.log("\nListe des entreprises nommées dans les conventions :");
        compRes.rows.forEach(r => console.log(`- ${r.ent_nom} (${r.count} conventions)`));

    } catch (e) {
        console.error("Error", e);
    } finally {
        pool.end();
    }
}

main();
