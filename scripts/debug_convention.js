require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT id, metadata->>'est_mineur' as raw_est_mineur 
            FROM conventions 
            LIMIT 5;
        `);
        console.log("Samples of est_mineur:", res.rows);
    } catch (err) {
        console.error("SQL Error:", err.message);
    } finally {
        client.release();
        pool.end();
    }
}
run();
