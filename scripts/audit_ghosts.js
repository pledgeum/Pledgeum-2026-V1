
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

async function auditGhosts() {
    const client = await pool.connect();
    try {
        console.log("Connected to DB.");

        // 1. Hunt for "Thomas Dubois" and "Simu Student"
        console.log("\n--- Hunting 'Ghost' Users ---");
        const ghosts = await client.query(`
            SELECT uid, first_name, last_name, email, establishment_uai, role 
            FROM users 
            WHERE (first_name ILIKE '%Thomas%' AND last_name ILIKE '%Dubois%')
               OR (first_name ILIKE '%Simu%' OR last_name ILIKE '%Simu%')
               OR (email LIKE '%simu%')
        `);
        console.table(ghosts.rows);

        if (ghosts.rows.length > 0) {
            const ghostIds = ghosts.rows.map(r => r.uid);
            console.log(`\n--- Conventions for Ghosts (${ghostIds.length} users) ---`);
            const params = ghostIds.map((_, i) => `$${i + 1}`);
            const ghostConvs = await client.query(`
                SELECT id, student_uid, establishment_uai, status, created_at
                FROM conventions
                WHERE student_uid IN (${params.join(',')})
            `, ghostIds);
            console.table(ghostConvs.rows);
        }

        // 2. Re-check Tyméo
        console.log("\n--- Re-verifying Tyméo ---");
        const tymeos = await client.query(`
            SELECT uid, first_name, last_name, establishment_uai 
            FROM users 
            WHERE first_name ILIKE 'Tyméo%'
        `);
        console.table(tymeos.rows);

        if (tymeos.rows.length > 0) {
            const tUid = tymeos.rows[0].uid;
            const tConvs = await client.query(`
                SELECT id, student_uid, establishment_uai, status, created_at 
                FROM conventions 
                WHERE student_uid = $1
            `, [tUid]);
            console.table(tConvs.rows);
        }

        // 3. General check of 9999999Z conventions just to see what's there
        console.log("\n--- All Conventions for 9999999Z (Top 20) ---");
        const allZ = await client.query(`
            SELECT c.id, c.student_uid, u.first_name, u.last_name, c.establishment_uai
            FROM conventions c
            LEFT JOIN users u ON c.student_uid = u.uid
            WHERE c.establishment_uai = '9999999Z'
            ORDER BY c.created_at DESC
            LIMIT 20
        `);
        console.table(allZ.rows);

    } catch (err) {
        console.error("Query Failed:", err);
    } finally {
        client.release();
        pool.end();
    }
}

auditGhosts();
