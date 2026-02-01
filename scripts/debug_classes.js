
const { Pool } = require('pg');

// Using credentials from .env.local
const pool = new Pool({
    user: 'Pledgeum_admin',
    host: '51.159.113.59',
    database: 'rdb',
    password: 'Fa2BVCcYmysEiyx!!!',
    port: 26093,
    ssl: { rejectUnauthorized: false } // Adding SSL just in case, typically needed for remote
});

async function inspectClasses() {
    const client = await pool.connect();
    try {
        console.log("--- Columns in 'classes' table ---");
        const schemaRes = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'classes'
        `);
        console.table(schemaRes.rows);

        console.log("\n--- Sample Classes Data ---");
        const dataRes = await client.query(`
            SELECT id, name, main_teacher_id 
            FROM classes 
            ORDER BY id DESC
            LIMIT 5
        `);
        console.table(dataRes.rows);

    } catch (err) {
        console.error("Error executing query:", err);
    } finally {
        client.release();
        pool.end();
    }
}

inspectClasses();
