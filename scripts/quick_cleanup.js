const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!connectionString) {
    console.error("Error: DATABASE_URL or POSTGRES_URL not found in .env.local");
    process.exit(1);
}

const pool = new Pool({
    connectionString: connectionString,
});

async function cleanup() {
    const client = await pool.connect();
    try {
        const uai = '9999999X';
        console.log(`[CLEANUP] Connected. Checking 'classes' schema...`);

        // Check ID type
        const typeRes = await client.query("SELECT pg_typeof(id) FROM classes LIMIT 1");
        if (typeRes.rows.length > 0) {
            console.log(`[CLEANUP] 'classes.id' column type is: ${typeRes.rows[0].pg_typeof}`);
        } else {
            console.log(`[CLEANUP] Could not determine 'classes.id' type (table might be empty).`);
            // Check information schema fallback
            const schemaRes = await client.query("SELECT data_type FROM information_schema.columns WHERE table_name = 'classes' AND column_name = 'id'");
            if (schemaRes.rows.length > 0) {
                console.log(`[CLEANUP] 'classes.id' schema type is: ${schemaRes.rows[0].data_type}`);
            }
        }

        // Delete conventions first to satisfy Foreign Key constraints
        console.log(`[CLEANUP] Deleting conventions for students of UAI: ${uai}...`);
        await client.query(
            "DELETE FROM conventions WHERE student_uid IN (SELECT uid FROM users WHERE role = 'student' AND establishment_uai = $1)",
            [uai]
        );

        console.log(`[CLEANUP] Deleting students for UAI: ${uai}...`);

        const res = await client.query(
            "DELETE FROM users WHERE role = 'student' AND establishment_uai = $1 RETURNING uid",
            [uai]
        );

        console.log(`[CLEANUP] Deleting classes for UAI: ${uai}...`);
        const resClasses = await client.query(
            "DELETE FROM classes WHERE establishment_uai = $1",
            [uai]
        );

        console.log(`[CLEANUP] Successfully deleted ${res.rowCount} students and ${resClasses.rowCount} classes.`);
    } catch (err) {
        console.error('[CLEANUP] Error:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

cleanup();
