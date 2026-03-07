const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function main() {
    try {
        const queryCheck = `
            SELECT id, created_at, status, student_uid, company_siret 
            FROM conventions 
            ORDER BY created_at DESC 
            LIMIT 5;
        `;
        const resCheck = await pool.query(queryCheck);
        console.log("Les 5 dernières conventions créées :");
        resCheck.rows.forEach(r => {
            console.log(`- ID: ${r.id}, Date: ${r.created_at}, Status: ${r.status}, Elève: ${r.student_uid}, Siret: ${r.company_siret}`);
        });
    } catch (e) {
        console.error("Error", e);
    } finally {
        pool.end();
    }
}

main();
