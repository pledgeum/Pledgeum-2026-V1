const { Pool } = require('pg');
const pool = new Pool({
    user: 'Pledgeum_admin',
    host: '51.159.113.59',
    database: 'rdb',
    password: 'Fa2BVCcYmysEiyx!!!',
    port: 26093,
    ssl: { rejectUnauthorized: false }
});

async function auditDelvarre() {
    const client = await pool.connect();
    try {
        console.log("🔍 Searching for users 'Delvarre'...");

        // 1. Find potential duplicates
        const res = await client.query(`
            SELECT 
                u.uid, u.email, u.first_name, u.last_name, u.role, u.temp_code, u.created_at, u.updated_at,
                (SELECT COUNT(*) FROM classes c WHERE c.main_teacher_id = u.uid) as class_count
            FROM users u
            WHERE u.last_name ILIKE '%Delvarre%'
        `);

        console.log(`found ${res.rows.length} records.`);
        res.rows.forEach(u => {
            console.log(`\n👤 User: [${u.uid}] ${u.first_name} ${u.last_name}`);
            console.log(`   Email: ${u.email}`);
            console.log(`   Role: ${u.role}`);
            console.log(`   TempCode: ${u.temp_code}`);
            console.log(`   Linked Classes: ${u.class_count}`);
            console.log(`   Created: ${u.created_at}, Updated: ${u.updated_at}`);
        });

        // 2. Check Classes linked to these IDs
        if (res.rows.length > 0) {
            const uids = res.rows.map(r => r.uid);
            console.log("\n🏫 Checking exact class details for these UIDs...");

            const classRes = await client.query(`
                SELECT c.id, c.name, c.main_teacher_id
                FROM classes c
                WHERE c.main_teacher_id = ANY($1::text[])
            `, [uids]);

            classRes.rows.forEach(c => {
                console.log(`   - Class [${c.name}] (ID: ${c.id}) is linked to Main Teacher UID: ${c.main_teacher_id}`);
            });
        }

    } catch (err) {
        console.error("Error:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

auditDelvarre();
