
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

async function auditConsistency() {
    const client = await pool.connect();
    try {
        console.log("Connected to DB.");

        // 1. Check UAI Distribution in Conventions
        console.log("--- Conventions UAI Distribution ---");
        const uaiDist = await client.query(`
            SELECT establishment_uai, COUNT(*) 
            FROM conventions 
            GROUP BY establishment_uai
        `);
        console.table(uaiDist.rows);

        // 2. Find Mismatches: Student is in Z, but Convention is in Y or NULL
        console.log("\n--- Checking Mismatches for Students of 9999999Z ---");
        // Get all students of 9999999Z
        const studentsZ = await client.query(`
             SELECT uid 
             FROM users 
             WHERE establishment_uai = '9999999Z' AND role = 'student'
        `);
        const uidsZ = studentsZ.rows.map(r => r.uid);
        console.log(`Found ${uidsZ.length} students in 9999999Z.`);

        if (uidsZ.length > 0) {
            // Find conventions for these students where convention.establishment_uai != '9999999Z'
            // Need placeholders for array
            const placeholders = uidsZ.map((_, i) => `$${i + 1}`).join(',');
            const query = `
                SELECT id, student_uid, establishment_uai, created_at
                FROM conventions
                WHERE student_uid IN (${placeholders})
                AND (establishment_uai != '9999999Z' OR establishment_uai IS NULL)
            `;
            const mismatches = await client.query(query, uidsZ);
            console.table(mismatches.rows);

            if (mismatches.rows.length === 0) {
                console.log("No mismatches found. All conventions for Z students are in Z.");
            }
        }

    } catch (err) {
        console.error("Query Failed:", err);
    } finally {
        client.release();
        pool.end();
    }
}

auditConsistency();
