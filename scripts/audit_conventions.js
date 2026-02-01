
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

async function auditConventions() {
    const client = await pool.connect();
    try {
        console.log("Connected to DB.");

        console.log("--- Audit Step 1: Recent Conventions ---");
        const query = `
            SELECT id, student_uid, establishment_uai, status, created_at 
            FROM conventions 
            ORDER BY created_at DESC 
            LIMIT 10;
        `;
        const res = await client.query(query);
        console.table(res.rows);

        // Optional: Check specific student "Tyméo" if possible, but finding by name requires joining users.
        // Let's try to join with users to get student names for better context.
        console.log("\n--- Audit Step 1b: Recent Conventions with Student Names ---");
        const queryWithNames = `
            SELECT c.id, u.first_name, u.last_name, c.establishment_uai, c.status, c.created_at
            FROM conventions c
            LEFT JOIN users u ON c.student_uid = u.uid
            ORDER BY c.created_at DESC
            LIMIT 10;
        `;
        const resNames = await client.query(queryWithNames);
        console.table(resNames.rows);

    } catch (err) {
        console.error("Query Failed:", err);
    } finally {
        client.release();
        pool.end();
    }
}

auditConventions();
