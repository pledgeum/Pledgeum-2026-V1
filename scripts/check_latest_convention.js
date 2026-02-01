
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

async function testPersistence() {
    const client = await pool.connect();
    try {
        console.log("Connected to DB.");
        console.log("--- Step 2: Database Confirmation (Pre-Check) ---");
        const preCheck = await client.query("SELECT * FROM conventions ORDER BY created_at DESC LIMIT 1");
        console.log("Last Convention ID:", preCheck.rows[0]?.id || "None");

        // Simulate logic that assumes an API call happens
        // Since I cannot run the frontend, I will manually execute the logic that 'api/sync/convention' does, 
        // OR better: I will inspect the log.
        // Wait, the prompt asks to identify if the failure is: Network, API, or DB.
        // I can check if the API code itself works by sending a curl request?
        // Yes, let's create a script to CURL the API? 
        // No, I can't browse localhost:3000 from here easily without starting the server.
        // I will assume the server code is what I read. 
        // Let's re-read line 670-745 of convention.ts carefully.
        // `syncToPostgres` is called (line 710). It calls `/api/sync/convention`.
        // If that fails, it logs to console but DOES NOT THROW in `submitConvention` (it's async void).
        // `submitConvention` adds to LOCAL store (line 706).
        // If user reloads, local store is gone. If `syncToPostgres` failed, DB is empty.
        // So the "Data vanishes on reload" symptom confirms `syncToPostgres` is failing or `api/sync/convention` is failing.

    } catch (err) {
        console.error("Query Failed:", err);
    } finally {
        client.release();
        pool.end();
    }
}

testPersistence();
