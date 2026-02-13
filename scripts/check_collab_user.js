const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

// Fallback to hardcoded string if env is missing (for debugging purposes only)
const connectionString = process.env.DATABASE_URL || 'postgres://Pledgeum_admin:Fa2BVCcYmysEiyx!!!@51.159.113.59:26093/rdb';

const pool = new Pool({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
});

async function checkUser() {
    const uid = 'collab-fca95709-169e-4364-a2f4-c2aad01826fe';
    console.log(`Checking for user: ${uid}`);

    try {
        const client = await pool.connect();
        try {
            const res = await client.query('SELECT * FROM users WHERE uid = $1', [uid]);
            console.log(`Row count: ${res.rowCount}`);
            if (res.rowCount > 0) {
                console.log('User found:', res.rows[0]);
            } else {
                console.log('User NOT found in database.');
            }
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Error querying database:', err);
    } finally {
        await pool.end();
    }
}

checkUser();
