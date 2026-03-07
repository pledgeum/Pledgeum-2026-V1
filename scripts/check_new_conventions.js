const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function main() {
    try {
        const queryCheck = `
            SELECT id, created_at, status, student_uid, establishment_uai, metadata->>'ent_nom' as ent_nom
            FROM conventions 
            ORDER BY created_at DESC 
            LIMIT 5;
        `;
        const resCheck = await pool.query(queryCheck);
        console.log("Les 5 dernières conventions BDD pures :");
        resCheck.rows.forEach(r => {
            console.log(`- Date: ${r.created_at}, Elève: ${r.student_uid}, UAI: ${r.establishment_uai}, Ent: ${r.ent_nom}`);
        });
    } catch (e) {
        console.error("Error", e);
    } finally {
        pool.end();
    }
}

main();
