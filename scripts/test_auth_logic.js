
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function simulateAuthorize(email, password) {
    try {
        console.log(`Simulating authorize for ${email}...`);
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
        const user = result.rows[0];

        if (!user) {
            console.log("User not found.");
            return null;
        }

        if (!user.password_hash) {
            console.log("User has no password hash.");
            return null;
        }

        // For simulation, we assume password matches if we are just checking logic
        // But let's actually try to compare if we had a password.
        // const passwordsMatch = await bcrypt.compare(password, user.password_hash);

        const userResult = {
            id: user.id || user.uid,
            email: user.email,
            role: user.role,
            establishment_uai: user.establishment_uai,
            name: `${user.first_name} ${user.last_name}`,
            must_change_password: user.must_change_password
        };

        console.log("Authorization Logic Successful:", userResult);
        return userResult;
    } catch (error) {
        console.error("Authorize Logic Error:", error);
        return null;
    }
}

async function runTests() {
    // Check school head
    await simulateAuthorize('fabrice.dumasdelage@gmail.com', 'dummy');
    // Check a student or teacher if we find one
    const { rows: others } = await pool.query("SELECT email FROM users WHERE role != 'school_head' LIMIT 2");
    for (const u of others) {
        await simulateAuthorize(u.email, 'dummy');
    }
    await pool.end();
}

runTests();
