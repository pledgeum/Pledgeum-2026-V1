
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

async function auditPollution() {
    const client = await pool.connect();
    try {
        console.log("Connected to DB.");

        // Step 1: SQL Census (Distribution by UAI)
        console.log("\n--- Step 1: Convention Distribution by UAI ---");
        const dist = await client.query(`
            SELECT establishment_uai, COUNT(*) as total_conventions 
            FROM conventions 
            GROUP BY establishment_uai
            ORDER BY total_conventions DESC;
        `);
        console.table(dist.rows);

        // Step 2: Pinpoint the "Polluter" (Thomas Dubois)
        console.log("\n--- Step 2: Trace 'Thomas Dubois' Conventions ---");
        // Note: Using student_uid as confirmed in previous steps
        const polluter = await client.query(`
            SELECT c.id, c.establishment_uai, u.first_name, u.last_name, u.email 
            FROM conventions c
            JOIN users u ON c.student_uid = u.uid
            WHERE u.last_name ILIKE 'Dubois' AND u.first_name ILIKE 'Thomas'
            LIMIT 10;
        `);
        console.table(polluter.rows);

        if (polluter.rows.length === 0) {
            console.log("No conventions found explicitly linked to a user named 'Thomas Dubois'.");
            console.log("Trying to find conventions with raw student data matching Dubois...");
            // Sometimes student name is stored in metadata or separate columns if user link is broken, 
            // but schema uses foreign key. Let's check if there are users named Thomas Dubois.
            const users = await client.query("SELECT uid, establishment_uai FROM users WHERE last_name ILIKE 'Dubois' AND first_name ILIKE 'Thomas'");
            console.log("Users named Thomas Dubois:", users.rows);
        }

        // Step 3: Check for generic test data patterns
        console.log("\n--- Step 3: Check for other potential test data patterns in 9999999Z ---");
        const testData = await client.query(`
            SELECT id, student_uid, establishment_uai, created_at
            FROM conventions
            WHERE establishment_uai = '9999999Z'
            ORDER BY created_at DESC
            LIMIT 20;
        `);
        console.table(testData.rows);

    } catch (err) {
        console.error("Query Failed:", err);
    } finally {
        client.release();
        pool.end();
    }
}

auditPollution();
