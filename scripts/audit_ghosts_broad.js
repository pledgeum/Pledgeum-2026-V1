const { Pool } = require('pg');
const pool = new Pool({
    user: 'Pledgeum_admin',
    host: '51.159.113.59',
    database: 'rdb',
    password: 'Fa2BVCcYmysEiyx!!!',
    port: 26093,
    ssl: { rejectUnauthorized: false }
});

async function broadHunt() {
    const client = await pool.connect();
    try {
        console.log("👻 Broad Hunt for Ghost Links...");

        // 1. Classes linked to Ghost
        console.log("\n🏫 Classes with Ghost Main Teachers:");
        const classRes = await client.query(`
            SELECT c.id, c.name, u.uid, u.first_name, u.last_name, u.email
            FROM classes c
            JOIN users u ON c.main_teacher_id = u.uid
            WHERE u.email LIKE 'teacher-%'
        `);
        classRes.rows.forEach(r => {
            console.log(`   - Class: ${r.name} -> ${r.first_name} ${r.last_name} (${r.email})`);
        });

        // 2. Conventions linked to Ghost
        console.log("\n📝 Conventions with Ghost Teachers:");
        const convRes = await client.query(`
            SELECT conv.id, conv.student_id, u.uid as teacher_uid, u.first_name, u.last_name, u.email
            FROM conventions conv
            JOIN users u ON conv.teacher_id = u.uid
            WHERE u.email LIKE 'teacher-%'
            LIMIT 20
        `);

        if (convRes.rows.length === 0) console.log("   (None found)");
        convRes.rows.forEach(r => {
            console.log(`   - Conv ${r.id} -> Teacher: ${r.first_name} ${r.last_name} (${r.email})`);
        });

        // 3. Search for any user with name 'Delvarre' again, just in case
        console.log("\n🔎 Generic Name Search 'Delvarre':");
        const nameRes = await client.query(`SELECT uid, email, role FROM users WHERE last_name ILIKE '%Delvarre%'`);
        nameRes.rows.forEach(u => console.log(`   - ${u.uid} / ${u.email} / ${u.role}`));

    } catch (err) {
        console.error(err);
    } finally {
        client.release();
        await pool.end();
    }
}

broadHunt();
