
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function check() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL
    });

    try {
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'conventions'
        `);
        console.table(res.rows);
    } catch (err) {
        console.error("❌ Erreur :", err);
    } finally {
        await pool.end();
    }
}

check();
