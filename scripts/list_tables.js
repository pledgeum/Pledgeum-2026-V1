const { Pool } = require('pg');

const pool = new Pool({
    user: 'Pledgeum_admin',
    host: '51.159.113.59',
    database: 'rdb',
    password: 'Fa2BVCcYmysEiyx!!!',
    port: 26093,
    ssl: { rejectUnauthorized: false }
});

async function listTables() {
    console.log("🔍 Listing Database Tables...");
    try {
        const client = await pool.connect();
        const res = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        `);

        console.log(`Found ${res.rowCount} tables:`);
        console.table(res.rows.map(r => r.table_name));

        client.release();
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

listTables();
