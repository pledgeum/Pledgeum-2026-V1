
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function checkLogin() {
    const email = 'pledgeum@gmail.com'; // Testing with a known account
    try {
        console.log(`Checking login for ${email}...`);
        const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (rows.length === 0) {
            console.log("User not found.");
            return;
        }
        const user = rows[0];
        console.log("User found:", { email: user.email, role: user.role, hasHash: !!user.password_hash });

        // We don't know the password here, but we can verify the DB connectivity and data integrity
        console.log("DB lookup successful.");
    } catch (err) {
        console.error("Login Check Error:", err);
    } finally {
        await pool.end();
    }
}

checkLogin();
