
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

const pool = new Pool(config);

async function checkSuspiciousUsers() {
    const client = await pool.connect();
    try {
        console.log("Connected to DB.");

        const suspiciousIds = [
            'jPJtsg4aD0f62BoLz2nlEjBHRut2',
            'q9OAlglcOFYFQaUx9ndgNfpeAjG3',
            'mock_user_id',
            '5CnHIaIE5XVwaPDjl4UknUx6eHi2' // Fabrice
        ];

        console.log("--- Checking User Details for Suspicious UIDs ---");
        const query = `
            SELECT uid, first_name, last_name, email, role, establishment_uai 
            FROM users 
            WHERE uid = ANY($1)
        `;
        const res = await client.query(query, [suspiciousIds]);
        console.table(res.rows);

    } catch (err) {
        console.error("Query Failed:", err);
    } finally {
        client.release();
        pool.end();
    }
}

checkSuspiciousUsers();
