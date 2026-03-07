const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function main() {
    try {
        const queryCheck = `
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users' 
        `;
        const resCheck = await pool.query(queryCheck);
        console.log("Database schema users table:");
        resCheck.rows.forEach(r => console.log(`- ${r.column_name} (${r.data_type})`));
    } catch (e) {
        console.error("Error", e);
    } finally {
        pool.end();
    }
}

main();
