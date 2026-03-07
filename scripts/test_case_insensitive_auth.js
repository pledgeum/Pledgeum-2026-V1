const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function verifyAuth(email) {
    console.log(`\nTesting lookup for: "${email}"`);
    try {
        const query = 'SELECT email, role, uid FROM users WHERE LOWER(email) = LOWER($1)';
        const res = await pool.query(query, [email]);

        if (res.rowCount > 0) {
            console.log('✅ Found match:');
            console.table(res.rows);
        } else {
            console.log('❌ No match found.');
        }
    } catch (err) {
        console.error('Error during lookup:', err);
    }
}

async function runTests() {
    // 1. Test lowercase version of an known account
    await verifyAuth('pledgeum@gmail.com');

    // 2. Test uppercase version
    await verifyAuth('Pledgeum@gmail.com');

    // 3. Test mixed case
    await verifyAuth('pLeDgEuM@gMaIl.CoM');

    await pool.end();
}

runTests();
