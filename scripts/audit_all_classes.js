const { Pool } = require('pg');
const pool = new Pool({
    user: 'Pledgeum_admin',
    host: '51.159.113.59',
    database: 'rdb',
    password: 'Fa2BVCcYmysEiyx!!!',
    port: 26093,
    ssl: { rejectUnauthorized: false }
});

async function listAllClasses() {
    const client = await pool.connect();
    try {
        console.log("🏫 Listing ALL Classes and Main Teachers...");
        const res = await client.query(`
            SELECT c.id, c.name, u.uid, u.first_name, u.last_name, u.email, u.temp_id
            FROM classes c
            LEFT JOIN users u ON c.main_teacher_id = u.uid
            ORDER BY c.name
        `);

        res.rows.forEach(r => {
            const teacherName = r.uid ? `${r.first_name} ${r.last_name}` : "⛔ UNASSIGNED";
            const email = r.email ? `(${r.email})` : "";
            const isGhost = r.email && r.email.startsWith('teacher-') ? "👻 GHOST" : "";
            console.log(`   [${r.name.padEnd(10)}] -> ${teacherName.padEnd(30)} ${email} ${isGhost}`);
        });

    } catch (err) {
        console.error(err);
    } finally {
        client.release();
        await pool.end();
    }
}

listAllClasses();
