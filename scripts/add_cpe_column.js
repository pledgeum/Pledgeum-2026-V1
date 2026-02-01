const { Pool } = require('pg');

const pool = new Pool({
    user: 'Pledgeum_admin',
    host: '51.159.113.59',
    database: 'rdb',
    password: 'Fa2BVCcYmysEiyx!!!',
    port: 26093,
    ssl: { rejectUnauthorized: false }
});

async function addCol() {
    console.log("🛠️  Adding 'cpe_id' column to 'classes' table...");
    const client = await pool.connect();
    try {
        await client.query(`
            ALTER TABLE classes 
            ADD COLUMN IF NOT EXISTS cpe_id TEXT;
        `);
        console.log("✅ Column 'cpe_id' added successfully (or already exists).");
    } catch (e) {
        console.error("❌ Error adding column:", e);
    } finally {
        client.release();
        await pool.end();
    }
}

addCol();
