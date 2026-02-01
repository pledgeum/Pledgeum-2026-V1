const { Pool } = require('pg');
const pool = new Pool({
    user: 'Pledgeum_admin',
    host: '51.159.113.59',
    database: 'rdb',
    password: 'Fa2BVCcYmysEiyx!!!',
    port: 26093,
    ssl: { rejectUnauthorized: false }
});

async function deepAudit() {
    const client = await pool.connect();
    try {
        const targetEmail = 'fabrice.dumasdelage@icloud.com';
        console.log(`\n🔍 X-RAY: Checking User ${targetEmail}`);

        // 1. X-Ray Active User
        const userRes = await client.query(`SELECT * FROM users WHERE email = $1`, [targetEmail]);
        if (userRes.rows.length === 0) {
            console.log("❌ User not found!");
        } else {
            const u = userRes.rows[0];
            console.log("✅ User Found:");
            console.log(JSON.stringify(u, null, 2));

            // Check for "teacher-" string in any field
            const raw = JSON.stringify(u);
            if (raw.includes('teacher-')) {
                console.log("\n⚠️ ALERT: String 'teacher-' found in user record!");
            } else {
                console.log("\n✅ Clean: No 'teacher-' string found in user record.");
            }

            // 2. Inspect Class Linkage
            console.log(`\n🏫 Checking Class assignment for UID: ${u.uid}`);
            const classRes = await client.query(`SELECT id, name, main_teacher_id FROM classes WHERE main_teacher_id = $1`, [u.uid]);
            if (classRes.rows.length === 0) {
                console.log("❌ No classes linked to this UID.");
            } else {
                classRes.rows.forEach(c => {
                    console.log(`   ✅ Linked Class: [${c.id}] ${c.name}`);
                });
            }
        }

        // 3. Hunt the Ghost
        console.log("\n👻 Hunting teachers with 'teacher-%' email...");
        const ghostRes = await client.query(`
            SELECT uid, email, first_name, last_name, temp_id 
            FROM users 
            WHERE email LIKE 'teacher-%' 
              AND (last_name ILIKE '%Delvarre%' OR last_name IS NULL)
        `);

        if (ghostRes.rows.length === 0) {
            console.log("❌ No ghost users found matching Delvarre or NULL name.");
        } else {
            console.log(`⚠️ Found ${ghostRes.rows.length} candidates:`);
            console.log(JSON.stringify(ghostRes.rows, null, 2));
        }

        // Extra: List ALL ghosts associated with any class just to see if we missed the name
        console.log("\n🕵️ Checking ALL classes linked to ANY 'teacher-%' user:");
        const linkedGhosts = await client.query(`
            SELECT c.name as class_name, u.email, u.first_name, u.last_name
            FROM classes c
            JOIN users u ON c.main_teacher_id = u.uid
            WHERE u.email LIKE 'teacher-%'
        `);
        linkedGhosts.rows.forEach(r => {
            console.log(`   - Class ${r.class_name}: ${r.first_name} ${r.last_name} (${r.email})`);
        });

    } catch (err) {
        console.error(err);
    } finally {
        client.release();
        await pool.end();
    }
}

deepAudit();
