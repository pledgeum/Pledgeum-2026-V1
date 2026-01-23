
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
});

async function inspect() {
    try {
        const client = await pool.connect();

        console.log("--- TABLE: classes ---");
        const classes = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'classes';
        `);
        console.table(classes.rows);

        console.log("--- TABLE: users ---");
        const users = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users';
        `);
        console.table(users.rows);

        client.release();
    } catch (err) {
        console.error("Error inspecting DB:", err);
    } finally {
        pool.end();
    }
}

inspect();
