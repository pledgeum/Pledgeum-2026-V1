require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function run() {
    try {
        const query = `
      SELECT name, city, classes
      FROM partners 
      WHERE classes::text ILIKE '%1-plp%'
      ORDER BY name ASC
    `;
        const res = await pool.query(query);
        console.log(`Found ${res.rows.length} partners for 1-PLP:`);
        res.rows.forEach(r => {
            console.log(`- ${r.name} (${r.city}) - Classes: ${JSON.stringify(r.classes)}`);
        });
    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}
run();
