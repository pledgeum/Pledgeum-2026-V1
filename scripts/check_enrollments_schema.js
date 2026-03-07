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
            WHERE table_name = 'student_enrollments';
        `;
        const resCheck = await pool.query(queryCheck);
        console.log("student_enrollments schema:");
        resCheck.rows.forEach(r => console.log(`- ${r.column_name} (${r.data_type})`));

        const q2 = `
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'classes';
        `;
        const res2 = await pool.query(q2);
        console.log("\nclasses schema:");
        res2.rows.forEach(r => console.log(`- ${r.column_name} (${r.data_type})`));
    } catch (e) {
        console.error("Error", e);
    } finally {
        pool.end();
    }
}

main();
