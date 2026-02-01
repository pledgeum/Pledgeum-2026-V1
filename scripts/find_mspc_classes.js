
const { Pool } = require('pg');

const pool = new Pool({
    user: 'Pledgeum_admin',
    host: '51.159.113.59',
    database: 'rdb',
    password: 'Fa2BVCcYmysEiyx!!!',
    port: 26093,
    ssl: { rejectUnauthorized: false }
});

async function findClasses() {
    const client = await pool.connect();
    try {
        console.log("🔍 Searching for classes with 'MSPC'...");

        const res = await client.query(`
            SELECT 
                c.id as class_id, 
                c.name as class_name, 
                c.main_teacher_id,
                u.first_name, 
                u.last_name, 
                u.email
            FROM classes c
            LEFT JOIN users u ON c.main_teacher_id = u.uid
            WHERE c.name ILIKE '%MSPC%'
        `);
        console.table(res.rows);

    } catch (err) {
        console.error(err);
    } finally {
        client.release();
        pool.end();
    }
}

findClasses();
