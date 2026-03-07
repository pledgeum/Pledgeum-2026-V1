const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
    try {
        const res = await pool.query('SELECT id, company_siret, student_uid, metadata->>\'ent_siret\' as meta_siret FROM conventions');
        console.log("Les conventions survivantes :");
        res.rows.forEach(r => console.log(`ID: ${r.id} | company_siret (SQL): ${r.company_siret} | metadata_siret: ${r.meta_siret}`));
    } catch (e) { console.error(e); }
    pool.end();
}
main();
