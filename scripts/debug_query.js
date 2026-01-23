
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const config = {
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    ssl: { rejectUnauthorized: false }
};

console.log("Connecting to:", config.host, config.database, config.user);

const pool = new Pool(config);

async function testQuery() {
    const client = await pool.connect();
    try {
        console.log("Connected.");
        const uai = '9999999X';
        const query = `
            SELECT 
                c.id as pg_id,
                c.name,
                c.main_teacher_id,
                u.first_name as teacher_first,
                u.last_name as teacher_last,
                u.email as teacher_email
            FROM classes c
            LEFT JOIN users u ON c.main_teacher_id = u.uid::text
            WHERE c.establishment_uai = $1
        `;
        console.log("Running query...");
        const res = await client.query(query, [uai]);
        console.log("Success! Rows:", res.rows.length);
        console.table(res.rows);
    } catch (err) {
        console.error("Query Failed:", err);
    } finally {
        client.release();
        pool.end();
    }
}

testQuery();
