require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'notification_logs'
        `);
        console.log("Schema of notification_logs:", res.rows);
    } finally {
        client.release();
        pool.end();
    }
}
run();
