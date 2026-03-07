
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function debugEstablishments() {
    const email = 'fabrice.dumasdelage@gmail.com';
    console.log(`Searching establishments for admin_email: ${email}`);

    try {
        const result = await pool.query('SELECT uai, name, admin_email FROM establishments WHERE LOWER(admin_email) = LOWER($1)', [email]);
        console.log('Results:');
        console.table(result.rows);

        // Also search for any establishment
        const result2 = await pool.query('SELECT uai, name, admin_email FROM establishments LIMIT 5');
        console.log('Sample Establishments:');
        console.table(result2.rows);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

debugEstablishments();
