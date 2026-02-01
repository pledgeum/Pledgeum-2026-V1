const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

async function seedPassword() {
    console.log("Seeding password for Pledgeum@gmail.com...");

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const password = 'Pledgeum2026!';
        const hash = await bcrypt.hash(password, 10);

        console.log("Generated hash for password.");

        // Update using uid if id doesn't exist (based on previous error)
        // actually we can just use email
        const res = await pool.query(
            "UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING uid, email, role",
            [hash, 'pledgeum@gmail.com']
        );

        if (res.rowCount === 0) {
            console.error("❌ User Pledgeum@gmail.com NOT FOUND. Could not update.");
            process.exit(1);
        }

        console.log("✅ User updated successfully:", res.rows[0]);

    } catch (err) {
        console.error("Error during seeding:", err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

seedPassword();
