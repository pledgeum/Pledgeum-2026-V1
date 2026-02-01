
const { Pool } = require('pg');

const pool = new Pool({
    user: 'Pledgeum_admin',
    host: '51.159.113.59',
    database: 'rdb',
    password: 'Fa2BVCcYmysEiyx!!!',
    port: 26093,
    ssl: { rejectUnauthorized: false }
});

async function addProxCommuneGeo() {
    const client = await pool.connect();
    try {
        console.log("🛠️ Adding Geolocation columns for 'prox_commune'...");

        const queries = [
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS prox_commune_zip TEXT;",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS prox_commune_lat TEXT;",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS prox_commune_lon TEXT;"
        ];

        for (const q of queries) {
            await client.query(q);
            console.log(`✅ Executed: ${q}`);
        }

    } catch (err) {
        console.error("❌ Error adding columns:", err);
    } finally {
        client.release();
        pool.end();
    }
}

addProxCommuneGeo();
