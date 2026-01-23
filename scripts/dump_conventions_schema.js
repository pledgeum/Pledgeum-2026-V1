
const { Pool } = require('pg');
const connectionString = 'postgresql://Pledgeum_admin:Fa2BVCcYmysEiyx!!!@51.159.113.59:26093/rdb';
const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

async function check() {
    const client = await pool.connect();
    try {
        console.log("--- CONVENTIONS COLUMNS ---");
        const res = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'conventions'`);
        res.rows.forEach(r => console.log(r.column_name));
    } finally {
        client.release();
        pool.end();
    }
}
check();
