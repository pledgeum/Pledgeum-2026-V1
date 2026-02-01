
const { Pool } = require('pg');

const pool = new Pool({
    user: 'Pledgeum_admin',
    host: '51.159.113.59',
    database: 'rdb',
    password: 'Fa2BVCcYmysEiyx!!!',
    port: 26093,
    ssl: { rejectUnauthorized: false }
});

async function findAllGhosts() {
    const client = await pool.connect();
    try {
        console.log("🔍 Finding ALL users with valid temp_id (Ghosts)...");

        const res = await client.query(`
            SELECT uid, email, first_name, last_name, temp_id, temp_code, establishment_uai
            FROM users 
            WHERE temp_id IS NOT NULL
        `);
        console.table(res.rows);

    } catch (err) {
        console.error(err);
    } finally {
        client.release();
        pool.end();
    }
}

findAllGhosts();
