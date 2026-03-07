
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
    console.log(`Deep search for: ${email}`);

    try {
        const result = await pool.query("SELECT uid, email, role, is_active, password_hash IS NOT NULL as has_password, LENGTH(email) as email_length FROM users WHERE email ILIKE $1", [email]);
        console.log('Results:');
        result.rows.forEach(row => {
            console.log(`UID: ${row.uid}, Email: '${row.email}' (Len: ${row.email_length}), Role: ${row.role}, Active: ${row.is_active}, HasPass: ${row.has_password}`);
        });

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

debugUser();
