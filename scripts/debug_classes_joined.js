
const { Pool } = require('pg');

// Using credentials from .env.local
const pool = new Pool({
    user: 'Pledgeum_admin',
    host: '51.159.113.59',
    database: 'rdb',
    password: 'Fa2BVCcYmysEiyx!!!',
    port: 26093,
    ssl: { rejectUnauthorized: false }
});

async function inspectClasses() {
    const client = await pool.connect();
    try {
        console.log("--- Classes with Main Teacher Assigned ---");
        const query = `
            SELECT c.id, c.name, c.main_teacher_id, u.email as teacher_email, u.uid as teacher_uid, u.role
            FROM classes c
            LEFT JOIN users u ON c.main_teacher_id = u.uid
            WHERE c.main_teacher_id IS NOT NULL
            LIMIT 10
        `;
        const res = await client.query(query);
        console.table(res.rows);

        if (res.rows.length > 0) {
            const sampleTeacher = res.rows[0];
            console.log("\n--- Sample Teacher Data ---");
            console.log(sampleTeacher);
        } else {
            console.log("No classes found with main_teacher_id assigned.");
        }

    } catch (err) {
        console.error("Error executing query:", err);
    } finally {
        client.release();
        pool.end();
    }
}

inspectClasses();
