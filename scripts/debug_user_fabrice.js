
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
    const email = 'fabrice.dumasdelage@gmail.com';
    console.log(`Searching for all variations of: ${email}`);

    try {
        const result = await pool.query('SELECT uid, email, role, password_hash IS NOT NULL as has_password, must_change_password FROM users WHERE LOWER(email) = LOWER($1)', [email]);
        console.log('Results:');
        console.table(result.rows);

        // Also check for 'fabrice' in general
        const result2 = await pool.query("SELECT uid, email, role FROM users WHERE email ILIKE '%fabrice%'");
        console.log('Results for ILIKE %fabrice%:');
        console.table(result2.rows);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

debugUser();
