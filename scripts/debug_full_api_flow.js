const { Pool } = require('pg');

const pool = new Pool({
    user: 'Pledgeum_admin',
    host: '51.159.113.59',
    database: 'rdb',
    password: 'Fa2BVCcYmysEiyx!!!',
    port: 26093,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    const client = await pool.connect();
    try {
        const classId = '661ea305-7c78-479a-8f9a-cae1b6262d83';
        console.log("🔍 Getting UAI for Class:", classId);

        const res = await client.query('SELECT establishment_uai FROM classes WHERE id = $1', [classId]);
        const uai = res.rows[0]?.establishment_uai;

        if (!uai) {
            console.error("❌ UAI not found for class");
            return;
        }
        console.log("👉 UAI:", uai);

        // Fetch from API
        const url = `http://localhost:3000/api/school/classes?uai=${uai}`;
        console.log("🌍 Fetching API:", url);

        const apiRes = await fetch(url);
        if (!apiRes.ok) throw new Error(`API Error: ${apiRes.status}`);

        const json = await apiRes.json();
        const cls = json.classes.find(c => c.id === classId);

        if (!cls) {
            console.error("❌ Class not found in API response");
        } else {
            console.log("✅ Class Found:", cls.name);
            console.log("📦 Main Teacher Data:", JSON.stringify(cls.mainTeacher, null, 2));
        }

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
