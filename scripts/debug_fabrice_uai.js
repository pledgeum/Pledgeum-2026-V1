
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function debugUserUAI() {
    const email = 'fabrice.dumasdelage@gmail.com';

    try {
        const result = await pool.query('SELECT uid, email, role, establishment_uai FROM users WHERE LOWER(email) = LOWER($1)', [email]);
        console.log('Results:');
        console.table(result.rows);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

debugUserUAI();
