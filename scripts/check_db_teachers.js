const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function main() {
    try {
        const query1 = `SELECT id, name FROM classes WHERE name LIKE '%1-PLP%'`;
        const res1 = await pool.query(query1);
        console.log("Classes:", res1.rows);

        if (res1.rows.length > 0) {
            const classId = res1.rows[0].id;
            const query2 = `SELECT * FROM teacher_assignments WHERE class_id = $1`;
            const res2 = await pool.query(query2, [classId]);
            console.log("Teacher assignments for class:", res2.rows);

            const query3 = `SELECT user_id, class_id FROM class_users WHERE class_id = $1`;
            const res3 = await pool.query(query3, [classId]);
            console.log("Users in class_users for class:", res3.rows.length);
        }

        const qAll = `SELECT COUNT(*) FROM teacher_assignments`;
        const rAll = await pool.query(qAll);
        console.log("Total teacher_assignments in DB:", rAll.rows);

    } catch (e) {
        console.error("Error", e);
    } finally {
        pool.end();
    }
}

main();
