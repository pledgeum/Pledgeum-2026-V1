
const { Pool } = require('pg');

const pool = new Pool({
    user: 'Pledgeum_admin',
    host: '51.159.113.59',
    database: 'rdb',
    password: 'Fa2BVCcYmysEiyx!!!',
    port: 26093,
    ssl: { rejectUnauthorized: false }
});

async function findUser() {
    const client = await pool.connect();
    try {
        console.log("🔍 Searching for 'Berepion'...");
        const res = await client.query(`
            SELECT uid, email, first_name, last_name, establishment_uai, role 
            FROM users 
            WHERE last_name ILIKE '%Berepion%' OR email ILIKE '%berepion%'
        `);
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        client.release();
        pool.end();
    }
}

findUser();
