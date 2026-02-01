
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: "postgres://Pledgeum_admin:Fa2BVCcYmysEiyx!!!@51.159.113.59:26093/rdb",
    ssl: { rejectUnauthorized: false }
});

async function checkDates() {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT id, date_start, date_end, metadata->>'stage_date_debut' as meta_start 
            FROM conventions 
            ORDER BY created_at DESC 
            LIMIT 5
        `);
        console.log("Conventions Dates Check:");
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}

checkDates();
