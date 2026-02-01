const { Pool } = require('pg');

const pool = new Pool({
    user: 'Pledgeum_admin',
    host: '51.159.113.59',
    database: 'rdb',
    password: 'Fa2BVCcYmysEiyx!!!',
    port: 26093,
    ssl: { rejectUnauthorized: false }
});

async function addTimestamps() {
    console.log("🛠️  Adding 'created_at' and 'updated_at' to 'teacher_assignments'...");
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        await client.query(`
            ALTER TABLE teacher_assignments 
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
        `);

        await client.query('COMMIT');
        console.log("✅ Columns added successfully.");
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("❌ Error adding columns:", e);
    } finally {
        client.release();
        await pool.end();
    }
}

addTimestamps();
