const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

async function verifyAuth() {
    console.log("Verifying credentials for Pledgeum@gmail.com...");

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const res = await pool.query("SELECT * FROM users WHERE email = $1", ['pledgeum@gmail.com']); // Lowercase check
        const user = res.rows[0];

        if (!user) {
            console.error("❌ User Pledgeum@gmail.com NOT FOUND in database.");
            process.exit(1);
        }

        console.log("✅ User found:", user.email, "Role:", user.role);

        if (!user.password_hash) {
            console.error("❌ User has no password_hash.");
            process.exit(1);
        }

        const match = await bcrypt.compare('Pledgeum2026!', user.password_hash);

        if (match) {
            console.log("✅ Password match SUCCESS for Pledgeum2026!");
        } else {
            console.error("❌ Password match FAILED for Pledgeum2026!");
            process.exit(1);
        }

    } catch (err) {
        console.error("Error during verification:", err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

verifyAuth();
