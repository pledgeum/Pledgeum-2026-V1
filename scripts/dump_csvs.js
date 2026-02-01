const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

const pool = new Pool({
    user: 'Pledgeum_admin',
    host: '51.159.113.59',
    database: 'rdb',
    password: 'Fa2BVCcYmysEiyx!!!',
    port: 26093,
    ssl: { rejectUnauthorized: false }
});

async function dumpCsv() {
    console.log("📊 Dumping Tables to CSV...");
    const client = await pool.connect();

    const outputDir = path.join(__dirname, '../public');

    try {
        // 1. Users
        console.log("   Dumping users...");
        const resUsers = await client.query("SELECT uid, email, first_name, last_name, role FROM users");
        const csvUsers = Papa.unparse(resUsers.rows);
        fs.writeFileSync(path.join(outputDir, 'dump_users.csv'), csvUsers);

        // 2. Classes
        console.log("   Dumping classes...");
        const resClasses = await client.query("SELECT id, name, main_teacher_id FROM classes");
        const csvClasses = Papa.unparse(resClasses.rows);
        fs.writeFileSync(path.join(outputDir, 'dump_classes.csv'), csvClasses);

        // 3. Teacher Assignments (The Junction Table)
        console.log("   Dumping teacher_assignments...");
        const resAssign = await client.query("SELECT * FROM teacher_assignments");
        const csvAssign = Papa.unparse(resAssign.rows);
        fs.writeFileSync(path.join(outputDir, 'dump_teacher_assignments.csv'), csvAssign);

        console.log("✅ Dump complete. Files in public/:");
        console.log("   - dump_users.csv");
        console.log("   - dump_classes.csv");
        console.log("   - dump_teacher_assignments.csv");

    } catch (e) {
        console.error("❌ Error dumping CSV:", e);
    } finally {
        client.release();
        await pool.end();
    }
}

dumpCsv();
