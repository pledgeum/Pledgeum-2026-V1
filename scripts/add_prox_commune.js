
const { Pool } = require('pg');

const pool = new Pool({
    user: 'Pledgeum_admin',
    host: '51.159.113.59',
    database: 'rdb',
    password: 'Fa2BVCcYmysEiyx!!!',
    port: 26093,
    ssl: { rejectUnauthorized: false }
});

async function addProxCommuneColumn() {
    const client = await pool.connect();
    try {
        console.log("🛠️ Adding 'prox_commune' column to 'users' table...");

        // Check if column exists
        const checkRes = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'prox_commune'
        `);

        if (checkRes.rowCount > 0) {
            console.log("ℹ️ Column 'prox_commune' already exists. Skipping.");
            return;
        }

        // Add Column
        await client.query(`
            ALTER TABLE users 
            ADD COLUMN prox_commune TEXT;
        `);
        console.log("✅ Column 'prox_commune' (TEXT) added successfully.");

    } catch (err) {
        console.error("❌ Error adding column:", err);
    } finally {
        client.release();
        pool.end();
    }
}

addProxCommuneColumn();
