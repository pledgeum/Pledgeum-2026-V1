const { Pool } = require('pg');
const pool = new Pool({
    user: 'Pledgeum_admin',
    host: '51.159.113.59',
    database: 'rdb',
    password: 'Fa2BVCcYmysEiyx!!!',
    port: 26093,
    ssl: { rejectUnauthorized: false }
});

async function huntGhost() {
    const client = await pool.connect();
    try {
        console.log("👻 Hunting for Ghost Account (Delvarre)...");

        // 1. Search by generic teacher pattern + loose name match
        const ghostRes = await client.query(`
            SELECT uid, email, first_name, last_name, temp_code, temp_id, role
            FROM users 
            WHERE email LIKE 'teacher-%' 
              AND (
                  last_name ILIKE '%Delvarre%' 
                  OR first_name ILIKE '%Cedric%'
                  OR last_name ILIKE '%Cedric%'
              )
        `);

        if (ghostRes.rows.length === 0) {
            console.log("❌ No teacher ghost accounts found with name matching Delvarre/Cedric.");
        } else {
            console.log(`✅ Found ${ghostRes.rows.length} candidates:`);
            ghostRes.rows.forEach(u => {
                console.log(`   👻 [${u.uid}] ${u.first_name} ${u.last_name} (${u.email})`);
                console.log(`      TempID: ${u.temp_id}, Code: ${u.temp_code}`);
            });
        }

        // 2. Search Classes for ANY ghost teacher
        console.log("\n🏫 Checking Classes linked to Ghost Users...");
        const classRes = await client.query(`
            SELECT c.id, c.name, c.main_teacher_id, u.first_name, u.last_name, u.email
            FROM classes c
            JOIN users u ON c.main_teacher_id = u.uid
            WHERE u.email LIKE 'teacher-%'
        `);

        if (classRes.rows.length === 0) {
            console.log("   No classes linked to ghost accounts found.");
        } else {
            classRes.rows.forEach(c => {
                console.log(`   🏫 Class '${c.name}' linked to Ghost: ${c.first_name} ${c.last_name} (${c.email})`);
            });
        }

    } catch (err) {
        console.error(err);
    } finally {
        client.release();
        await pool.end();
    }
}

huntGhost();
