const { Pool } = require('pg');

const pool = new Pool({
    user: 'Pledgeum_admin',
    host: '51.159.113.59',
    database: 'rdb',
    password: 'Fa2BVCcYmysEiyx!!!',
    port: 26093,
    ssl: { rejectUnauthorized: false }
});

async function debugQuery() {
    const client = await pool.connect();
    try {
        const classId = '661ea305-7c78-479a-8f9a-cae1b6262d83'; // 1-PLP

        console.log("🔍 Inspecting Class:", classId);

        // 1. Get Main Teacher ID from Class
        const classRes = await client.query('SELECT main_teacher_id FROM classes WHERE id = $1', [classId]);
        const mainTeacherId = classRes.rows[0]?.main_teacher_id;
        console.log("👉 Main Teacher ID:", mainTeacherId);

        if (!mainTeacherId) {
            console.log("❌ No Main Teacher Assigned in DB");
            return;
        }

        // 2. Get Ghost User Details
        const ghostRes = await client.query('SELECT * FROM users WHERE uid = $1', [mainTeacherId]);
        const ghost = ghostRes.rows[0];
        console.log("👻 Ghost User:", {
            uid: ghost.uid,
            first: ghost.first_name,
            last: ghost.last_name,
            email: ghost.email
        });

        // 3. Search for Match using CURRENT Logic
        const queryCurrent = `
            SELECT * 
            FROM users real_u 
            WHERE real_u.first_name = $1 
              AND real_u.last_name = $2 
              AND real_u.role = 'teacher' 
              AND real_u.email NOT LIKE 'teacher-%' 
              AND real_u.email NOT LIKE '%@pledgeum.temp'
        `;
        const matchRes = await client.query(queryCurrent, [ghost.first_name, ghost.last_name]);
        console.log("🕵️ Match Result (Case Sensitive):", matchRes.rows.length > 0 ? matchRes.rows[0].email : "NONE");

        // 4. Search with Case Insensitive
        const queryCI = `
            SELECT * 
            FROM users real_u 
            WHERE LOWER(real_u.first_name) = LOWER($1) 
              AND LOWER(real_u.last_name) = LOWER($2)
              AND real_u.role = 'teacher' 
              AND real_u.email NOT LIKE 'teacher-%' 
              AND real_u.email NOT LIKE '%@pledgeum.temp'
        `;
        const matchCI = await client.query(queryCI, [ghost.first_name, ghost.last_name]);
        console.log("🕵️ Match Result (Case Insensitive):", matchCI.rows.length > 0 ? matchCI.rows[0].email : "NONE");

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

debugQuery();
