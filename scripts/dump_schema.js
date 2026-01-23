
const { Pool } = require('pg');

// Hardcoded from .env.local
const connectionString = 'postgresql://Pledgeum_admin:Fa2BVCcYmysEiyx!!!@51.159.113.59:26093/rdb';

const pool = new Pool({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
});

async function dumpSchema() {
    const client = await pool.connect();
    try {
        console.log("--- USERS COLUMNS ---");
        const res = await client.query(`
            SELECT column_name, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'users'
        `);
        res.rows.forEach(r => console.log(`${r.column_name}: ${r.is_nullable}`));

        console.log("\n--- USER 9999999X check ---");
        // Check if I can see the user's row if they exist? No, I don't have the UID.
        // But I can check constraints.
        const constraints = await client.query(`
            SELECT conname, contype, pg_get_constraintdef(oid)
            FROM pg_constraint
            WHERE conrelid = 'users'::regclass;
        `);
        console.table(constraints.rows);

    } catch (e) {
        console.error("Error:", e);
    } finally {
        client.release();
        await pool.end();
    }
}

dumpSchema();
