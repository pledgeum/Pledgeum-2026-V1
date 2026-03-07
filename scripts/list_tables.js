const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function main() {
    try {
        const queryCheck = `
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public';
        `;
        const resCheck = await pool.query(queryCheck);
        console.log("Tables in database:");
        console.log(resCheck.rows.map(r => r.table_name).join(', '));
    } catch (e) {
        console.error("Error", e);
    } finally {
        pool.end();
    }
}

main();
