
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const config = {
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    ssl: { rejectUnauthorized: false }
};

const pool = new Pool(config);

async function wipeConventions() {
    const client = await pool.connect();
    try {
        console.log("Connected to DB.");

        console.log("--- Executing Wipe: DELETE FROM conventions ---");
        const res = await client.query("DELETE FROM conventions");
        console.log(`Deleted ${res.rowCount} rows.`);

        console.log("--- Verification: Counting Rows ---");
        const countRes = await client.query("SELECT COUNT(*) FROM conventions");
        console.log(`Remaining Conventions: ${countRes.rows[0].count}`);

    } catch (err) {
        console.error("Query Failed:", err);
    } finally {
        client.release();
        pool.end();
    }
}

wipeConventions();
