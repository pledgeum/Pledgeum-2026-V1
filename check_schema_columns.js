const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/pledgeum_local', // Adjust if needed
});

async function checkSchema() {
    const client = await pool.connect();
    try {
        console.log("Checking 'users' table columns:");
        const usersRes = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users';
        `);
        console.table(usersRes.rows);

        console.log("Checking 'classes' table columns:");
        const classesRes = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'classes';
        `);
        console.table(classesRes.rows);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        client.release();
        pool.end();
    }
}

checkSchema();
