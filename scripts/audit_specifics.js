
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

async function auditSpecifics() {
    const client = await pool.connect();
    try {
        console.log("Connected to DB.");

        // 1. Find Tyméo
        console.log("--- Finding Student 'Tyméo' ---");
        const tymeos = await client.query("SELECT uid, first_name, last_name, email, role, establishment_uai FROM users WHERE first_name ILIKE '%Tyméo%'");
        console.table(tymeos.rows);

        if (tymeos.rows.length > 0) {
            const uid = tymeos.rows[0].uid;
            console.log(`--- Conventions for Tyméo (${uid}) ---`);
            const convs = await client.query("SELECT id, establishment_uai, status, created_at FROM conventions WHERE student_uid = $1", [uid]);
            console.table(convs.rows);
        } else {
            console.log("Tyméo not found.");
        }

        // 2. Find School Heads of 9999999Z
        console.log("\n--- School Heads of 9999999Z ---");
        const heads = await client.query("SELECT uid, first_name, last_name, email, role, establishment_uai FROM users WHERE establishment_uai = '9999999Z' AND (role = 'establishments_admin' OR role = 'school_head' OR role = 'admin' OR role = 'DIR')"); // Guessing role names, will adjust if needed.
        // Actually let's just show all users of 9999999Z to find the head
        const allUsersZ = await client.query("SELECT uid, first_name, last_name, email, role, establishment_uai FROM users WHERE establishment_uai = '9999999Z' LIMIT 20");
        console.table(allUsersZ.rows);

    } catch (err) {
        console.error("Query Failed:", err);
    } finally {
        client.release();
        pool.end();
    }
}

auditSpecifics();
