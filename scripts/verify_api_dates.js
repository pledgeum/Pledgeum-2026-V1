
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const config = {
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    ssl: { rejectUnauthorized: false }
};

const pool = new Pool(config);

async function verifyApiDates() {
    const client = await pool.connect();
    try {
        console.log("Connected. Running Verification Query...");
        // This query mimics the API's new logic
        const query = `
            SELECT 
                TO_CHAR(date_start, 'YYYY-MM-DD') as "dateStart",
                TO_CHAR(date_end, 'YYYY-MM-DD') as "dateEnd"
            FROM conventions 
            WHERE student_uid IN (SELECT uid FROM users WHERE first_name LIKE '%Tyméo%')
            ORDER BY created_at DESC 
            LIMIT 1;
        `;
        const res = await client.query(query);
        const row = res.rows[0];

        console.table(row);

        if (row && typeof row.dateStart === 'string' && row.dateStart.match(/^\d{4}-\d{2}-\d{2}$/)) {
            console.log("SUCCESS: dateStart is a properly formatted string: " + row.dateStart);
        } else {
            console.error("FAILURE: dateStart format is incorrect or not a string", row?.dateStart);
        }

        if (row && typeof row.dateEnd === 'string' && row.dateEnd.match(/^\d{4}-\d{2}-\d{2}$/)) {
            console.log("SUCCESS: dateEnd is a properly formatted string: " + row.dateEnd);
        } else {
            console.error("FAILURE: dateEnd format is incorrect or not a string", row?.dateEnd);
        }

    } catch (err) {
        console.error("Query Failed:", err);
    } finally {
        client.release();
        pool.end();
    }
}

verifyApiDates();
