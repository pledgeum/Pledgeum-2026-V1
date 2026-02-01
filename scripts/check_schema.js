
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

async function checkSchema() {
    const client = await pool.connect();
    try {
        console.log("--- Indices for 'companies' ---");
        const resCompanies = await client.query(`SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'companies'`);
        console.table(resCompanies.rows);

        console.log("\n--- Indices for 'conventions' ---");
        const resConventions = await client.query(`SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'conventions'`);
        console.table(resConventions.rows);

        console.log("\n--- Indices for 'users' ---");
        const resUsers = await client.query(`SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'users'`);
        console.table(resUsers.rows);

    } catch (err) {
        console.error("Query Failed:", err);
    } finally {
        client.release();
        pool.end();
    }
}

checkSchema();
