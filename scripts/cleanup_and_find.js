
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

async function cleanupAndFindTymeo() {
    const client = await pool.connect();
    try {
        console.log("Connected to DB.");

        console.log("--- Cleanup Step: Deleting Confirmed Ghost Data ---");

        // 1. Delete Simu conventions (id starts with simu_e2e_ OR student_uid starts with user_simu_)
        // 2. Delete Thomas Dubois (student_uid = 'thomas.dubois@email.com')
        const cleanupQuery = `
            DELETE FROM conventions 
            WHERE establishment_uai = '9999999Z' 
            AND (
                id LIKE 'simu_e2e_%' 
                OR student_uid LIKE 'user_simu_%'
                OR student_uid = 'thomas.dubois@email.com'
                OR student_uid = 'bypassed_user'
            );
        `;

        console.log("Executing cleanup query...");
        const res = await client.query(cleanupQuery);
        console.log(`Success! Deleted ${res.rowCount} rows.`);

        // 3. Find Tyméo (Fuzzy Search)
        console.log("\n--- Finding Tyméo (Broader Search) ---");
        // Check for Berthou, or Tymeo without accent
        const tymeos = await client.query(`
            SELECT uid, first_name, last_name, email, role, establishment_uai 
            FROM users 
            WHERE last_name ILIKE '%BERTHOU%' 
               OR first_name ILIKE '%Tymeo%'
               OR email ILIKE '%tymeo%'
        `);
        console.table(tymeos.rows);

        if (tymeos.rows.length === 0) {
            console.log("STILL Validating: Tyméo is missing from Postgres Users table.");
            console.log("Hypothesis: He exists in Firebase but was not synced/imported to Postgres.");
        } else {
            console.log("Found Tyméo! Checking his conventions...");
            const tUid = tymeos.rows[0].uid;
            const tConvs = await client.query(`
                 SELECT id, establishment_uai, status, created_at 
                 FROM conventions 
                 WHERE student_uid = $1
             `, [tUid]);
            console.table(tConvs.rows);
        }

    } catch (err) {
        console.error("Query Failed:", err);
    } finally {
        client.release();
        pool.end();
    }
}

cleanupAndFindTymeo();
