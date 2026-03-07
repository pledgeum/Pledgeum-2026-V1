const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function main() {
    try {
        const queryCheck = `
            SELECT id, created_at, status, student_uid, metadata->>'ent_nom' as ent_nom
            FROM conventions 
            ORDER BY created_at DESC 
            LIMIT 20;
        `;
        const resCheck = await pool.query(queryCheck);
        console.log("Les 20 dernières conventions absolues BDD :");
        resCheck.rows.forEach(r => {
            console.log(`- Date: ${r.created_at}, Elève: ${r.student_uid}, ID: ${r.id}, Ent: ${r.ent_nom}`);
        });
    } catch (e) {
        console.error("Error", e);
    } finally {
        pool.end();
    }
}

main();
