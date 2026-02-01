
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

async function cleanupSimuConventions() {
    const client = await pool.connect();
    try {
        console.log("Connected to DB.");

        console.log("--- Cleanup Step: Deleting Simu/Null Student Conventions for 9999999Z ---");

        // Note: Correcting student_id to student_uid based on previous schema knowledge
        const query = `
            DELETE FROM conventions 
            WHERE establishment_uai = '9999999Z' 
            AND (student_uid IS NULL OR student_uid LIKE 'simu_%');
        `;

        console.log("Executing query:", query);
        const res = await client.query(query);
        console.log(`Success! Deleted ${res.rowCount} rows.`);

    } catch (err) {
        console.error("Query Failed:", err);
    } finally {
        client.release();
        pool.end();
    }
}

cleanupSimuConventions();
