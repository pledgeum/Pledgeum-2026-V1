
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function runVerification() {
    const client = await pool.connect();
    const schoolId = '9999999X'; // Sandbox UAI
    const timestamp = Date.now();
    const testTeacher = {
        firstName: `Verif${timestamp}`,
        lastName: `TestProf`,
        email: `teacher.verif.${timestamp}@test.com`
    };

    try {
        console.log("1. Finding a valid class for UAI:", schoolId);
        // Find a class to assign
        const clsRes = await client.query('SELECT name FROM classes WHERE establishment_uai = $1 LIMIT 1', [schoolId]);
        if (clsRes.rowCount === 0) {
            console.error("No classes found for sandbox. Cannot verify assignment.");
            return;
        }
        const className = clsRes.rows[0].name;
        console.log("   Target Class:", className);

        // 2. Call the API (Simulated call via fetch if server running, OR we can just allow the user to run it via curl?)
        // Actually, calling localhost:3000 from this script is possible if node-fetch is available, or we use built-in fetch in Node 18+

        console.log("2. Sending Import Request via fetch...");
        const payload = {
            schoolId: schoolId,
            schoolYear: "2025-2026",
            teachers: [
                {
                    teacher: testTeacher,
                    classes: [className] // Should map to the ID found above
                }
            ]
        };

        const response = await fetch('http://localhost:3000/api/school/import-teachers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error("API Request Failed:", await response.text());
            return;
        }

        const result = await response.json();
        console.log("   API Response:", result);

        // 3. Verify DB
        console.log("3. Verifying Database State...");

        // Check User
        const userRes = await client.query('SELECT uid, email FROM users WHERE email = $1', [testTeacher.email]);
        if (userRes.rowCount === 0) {
            console.error("❌ Teacher NOT found in users table.");
        } else {
            console.log("✅ Teacher Found in users table:", userRes.rows[0]);
            const uid = userRes.rows[0].uid;

            // Check Assignment
            const assignRes = await client.query(`
            SELECT ta.class_id, c.name, c.id 
            FROM teacher_assignments ta
            JOIN classes c ON ta.class_id = c.id
            WHERE ta.teacher_uid = $1
        `, [uid]);

            if (assignRes.rowCount > 0) {
                console.log("✅ Teacher Assignment Found:", assignRes.rows[0]);
                if (assignRes.rows[0].name === className) {
                    console.log("✅ Class Name Matches!");
                } else {
                    console.error("❌ Class Name Mismatch. Expected:", className, "Got:", assignRes.rows[0].name);
                }
            } else {
                console.error("❌ No Teacher Assignment found in table.");
            }
        }

    } catch (err) {
        console.error("Verification Error:", err);
    } finally {
        client.release();
        pool.end();
    }
}

runVerification();
