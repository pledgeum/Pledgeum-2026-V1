const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = require('dotenv').parse(fs.readFileSync(envPath));

const pool = new Pool({
    user: envConfig.POSTGRES_USER,
    host: envConfig.POSTGRES_HOST,
    database: envConfig.POSTGRES_DB,
    password: envConfig.POSTGRES_PASSWORD,
    port: envConfig.POSTGRES_PORT,
    ssl: { rejectUnauthorized: false }
});

async function auditPhoneColumns() {
    const client = await pool.connect();
    const uai = '9999999Z';
    try {
        console.log(`\n--- SCHEMA AUDIT: establishments table ---`);
        const cols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'establishments' 
      AND (column_name ILIKE '%phone%' OR column_name ILIKE '%tel%')
    `);
        console.table(cols.rows);

        console.log(`\n--- DATA AUDIT: UAI ${uai} ---`);
        // Construct dynamic query based on found columns
        if (cols.rows.length > 0) {
            const colNames = cols.rows.map(c => c.column_name).join(', ');
            const query = `SELECT uai, name, ${colNames} FROM establishments WHERE uai = $1`;
            const res = await client.query(query, [uai]);
            console.table(res.rows);
        } else {
            console.log("No phone-like columns found!");
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        client.release();
        pool.end();
    }
}

auditPhoneColumns();
