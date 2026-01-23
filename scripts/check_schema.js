
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkSchema() {
    const client = await pool.connect();
    try {
        const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
        console.log("Tables:", res.rows.map(r => r.table_name));

        // Check columns of users and classes
        const userCols = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'users'
    `);
        console.log("Users Columns:", userCols.rows.map(r => r.column_name));

        const classCols = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'classes'
    `);
        console.log("Classes Columns:", classCols.rows.map(r => r.column_name));

    } catch (err) {
        console.error("Error:", err);
    } finally {
        client.release();
        pool.end();
    }
}

checkSchema();
