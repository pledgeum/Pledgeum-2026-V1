const { Pool } = require('pg');
const pool = new Pool({
    user: 'Pledgeum_admin',
    host: '51.159.113.59',
    database: 'rdb',
    password: 'Fa2BVCcYmysEiyx!!!',
    port: 26093,
    ssl: { rejectUnauthorized: false }
});

async function investigate() {
    const client = await pool.connect();
    try {
        console.log("🔍 Searching for users by EMAIL pattern...");

        const res = await client.query(`
            SELECT 
                u.uid, u.email, u.first_name, u.last_name, u.role, u.temp_code, u.updated_at,
                (SELECT COUNT(*) FROM classes c WHERE c.main_teacher_id = u.uid) as class_count
            FROM users u
            WHERE u.email ILIKE '%fabrice%' 
               OR u.email ILIKE '%firas%'
               OR u.first_name ILIKE '%Firas%'
        `);

        console.log(`🔎 Found ${res.rows.length} users:`);
        res.rows.forEach(u => {
            console.log(`   - [${u.uid}] ${u.email} (${u.first_name} ${u.last_name})`);
            console.log(`     Classes: ${u.class_count}, Updated: ${u.updated_at}, Code: ${u.temp_code}`);
        });

    } catch (err) {
        console.error(err);
    } finally {
        client.release();
        await pool.end();
    }
}

investigate();
