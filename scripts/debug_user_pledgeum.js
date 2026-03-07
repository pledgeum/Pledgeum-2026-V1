
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function debugUser() {
    const email = 'pledgeum@gmail.com';
    console.log(`Deep search for: ${email}`);

    try {
        const result = await pool.query("SELECT uid, email, role, is_active, password_hash IS NOT NULL as has_password FROM users WHERE email ILIKE $1", [email]);
        console.log('Results:');
        console.table(result.rows);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

debugUser();
