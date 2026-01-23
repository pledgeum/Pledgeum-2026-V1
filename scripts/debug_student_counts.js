const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!connectionString) {
    console.error("Error: DATABASE_URL or POSTGRES_URL not found");
    process.exit(1);
}

const pool = new Pool({ connectionString });

async function debug() {
    const client = await pool.connect();
    const UAI = '9999999X';

    try {
        console.log(`--- DEBUGGING FOR UAI: ${UAI} ---`);

        // 1. Count Total Students
        const resStudents = await client.query("SELECT COUNT(*) FROM users WHERE role = 'student' AND establishment_uai = $1", [UAI]);
        console.log(`Total Students in DB for UAI: ${resStudents.rows[0].count}`);

        // 2. Count Total Classes
        const resClasses = await client.query("SELECT COUNT(*) FROM classes WHERE establishment_uai = $1", [UAI]);
        console.log(`Total Classes in DB for UAI: ${resClasses.rows[0].count}`);

        // 3. Check Distribution (Students per Class)
        console.log(`\n--- STUDENT DISTRIBUTION BY CLASS ---`);
        const resDist = await client.query(`
        SELECT c.name, c.id, COUNT(u.uid) as count
        FROM classes c
        LEFT JOIN users u ON u.class_id = c.id
        WHERE c.establishment_uai = $1
        GROUP BY c.id, c.name
        ORDER BY c.name
    `, [UAI]);

        resDist.rows.forEach(r => {
            console.log(`Class: ${r.name.padEnd(20)} | ID: ${r.id.substring(0, 8)}... | Count: ${r.count}`);
        });

        // 4. Check potential Orphans (Students with class_id that doesn't exist in classes table?)
        const resOrphans = await client.query(`
        SELECT COUNT(*) 
        FROM users u 
        WHERE u.role = 'student' 
          AND u.establishment_uai = $1
          AND u.class_id NOT IN (SELECT id FROM classes)
    `, [UAI]);
        console.log(`\nOrphaned Students (Invalid Class ID): ${resOrphans.rows[0].count}`);

        // 5. Check NULL Class IDs
        const resNull = await client.query(`
        SELECT COUNT(*) FROM users WHERE role = 'student' AND establishment_uai = $1 AND class_id IS NULL
    `, [UAI]);
        console.log(`Students with NULL Class ID: ${resNull.rows[0].count}`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        client.release();
        pool.end();
    }
}

debug();
