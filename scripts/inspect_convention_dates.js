
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

async function inspectDates() {
    const client = await pool.connect();
    try {
        console.log("Connected. Running TRUE inspection query...");
        const query = `
            SELECT 
                id,
                date_start,              
                date_end,                
                metadata,
                updated_at,
                establishment_uai
            FROM conventions 
            WHERE student_uid IN (SELECT uid FROM users WHERE first_name LIKE '%Tyméo%')
            ORDER BY created_at DESC 
            LIMIT 1;
        `;
        const res = await client.query(query);
        console.log("Query Result:");
        if (res.rows.length === 0) {
            console.log("No convention found for student with first name matching 'Tyméo'.");
        } else {
            const row = res.rows[0];
            console.table(row);

            // Check deep inside metadata if dates are hiding there
            if (row.metadata) {
                console.log("Metadata content:", JSON.stringify(row.metadata, null, 2));
            } else {
                console.log("Metadata is null/empty");
            }

            // Check raw values of dates
            console.log("Raw date_start:", row.date_start);
            console.log("Raw date_end:", row.date_end);
        }
    } catch (err) {
        console.error("Query Failed:", err);
    } finally {
        client.release();
        pool.end();
    }
}

inspectDates();
