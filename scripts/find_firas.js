
const { Pool } = require('pg');

const pool = new Pool({
    user: 'Pledgeum_admin',
    host: '51.159.113.59',
    database: 'rdb',
    password: 'Fa2BVCcYmysEiyx!!!',
    port: 26093,
    ssl: { rejectUnauthorized: false }
});

async function findFiras() {
    const client = await pool.connect();
    try {
        console.log("🔍 Searching for 'Firas Ayadi'...");

        // 1. Find ALL Teachers
        const userRes = await client.query(`
            SELECT uid, email, first_name, last_name, establishment_uai, role, created_at, temp_id
            FROM users 
            WHERE role = 'teacher' OR role LIKE 'teacher%'
            ORDER BY created_at DESC
        `);
        console.table(userRes.rows);

        if (userRes.rows.length === 0) {
            console.log("❌ No users found.");
            return;
        }

        // 2. Check Class Assignments for these UIDs
        const uids = userRes.rows.map(r => r.uid);
        console.log(`\n🔍 Checking classes for UIDs: ${uids.join(', ')}`);

        const classRes = await client.query(`
            SELECT c.id, c.name, c.main_teacher_id
            FROM classes c
            WHERE c.main_teacher_id = ANY($1)
        `, [uids]);

        if (classRes.rows.length > 0) {
            console.table(classRes.rows);
        } else {
            console.log("⚠️ No classes currently linked to these users.");
        }

    } catch (err) {
        console.error(err);
    } finally {
        client.release();
        pool.end();
    }
}

findFiras();
