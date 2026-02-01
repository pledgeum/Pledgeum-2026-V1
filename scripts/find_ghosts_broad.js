
const { Pool } = require('pg');

const pool = new Pool({
    user: 'Pledgeum_admin',
    host: '51.159.113.59',
    database: 'rdb',
    password: 'Fa2BVCcYmysEiyx!!!',
    port: 26093,
    ssl: { rejectUnauthorized: false }
});

async function findGhosts() {
    const client = await pool.connect();
    try {
        console.log("🔍 Finding ALL classes linked to Ghost Accounts...");

        const res = await client.query(`
            SELECT 
                c.id as class_id, 
                c.name as class_name, 
                u.uid as teacher_uid, 
                u.first_name, 
                u.last_name, 
                u.email,
                u.establishment_uai
            FROM classes c
            JOIN users u ON c.main_teacher_id = u.uid
            WHERE u.email LIKE 'teacher-%'
        `);
        console.table(res.rows);

    } catch (err) {
        console.error(err);
    } finally {
        client.release();
        pool.end();
    }
}

findGhosts();
