
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

async function runInspection() {
    const client = await pool.connect();
    try {
        console.log("--- STEP 1: SCHEMA INSPECTION ---");
        const schemaRes = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'conventions'
            ORDER BY column_name;
        `);
        console.table(schemaRes.rows);

        // Determine if 'data' or 'metadata' exists
        const structure = schemaRes.rows.map(r => r.column_name);
        const jsonCol = structure.includes('data') ? 'data' : (structure.includes('metadata') ? 'metadata' : null);

        console.log(`\nDetected JSON column: ${jsonCol}`);

        // Check for various date column possibilities
        const dateStartCol = structure.includes('date_debut') ? 'date_debut' : (structure.includes('date_start') ? 'date_start' : 'NULL');
        const dateEndCol = structure.includes('date_fin') ? 'date_fin' : (structure.includes('date_end') ? 'date_end' : 'NULL');

        console.log(`Detected Date Columns: ${dateStartCol}, ${dateEndCol}`);

        console.log("\n--- STEP 2: DATA CONTENT INSPECTION (Last 3) ---");

        let query = "";

        if (jsonCol) {
            query = `
                SELECT 
                    id,
                    ${dateStartCol === 'NULL' ? "NULL as date_start_col" : dateStartCol}, 
                    ${dateEndCol === 'NULL' ? "NULL as date_end_col" : dateEndCol},
                    ${jsonCol}->>'dateStart' as json_dateStart,
                    ${jsonCol}->>'dateEnd' as json_dateEnd,
                    ${jsonCol}->>'date_debut' as json_date_debut,
                    ${jsonCol}->>'stage_date_debut' as json_stage_date_debut,
                    ${jsonCol}->>'stage_date_fin' as json_stage_date_fin
                FROM conventions 
                ORDER BY created_at DESC 
                LIMIT 3;
            `;
        } else {
            console.log("No JSON column found, querying only scalar columns.");
            query = `
                SELECT 
                    id,
                    ${dateStartCol === 'NULL' ? "NULL as date_start_col" : dateStartCol}, 
                    ${dateEndCol === 'NULL' ? "NULL as date_end_col" : dateEndCol}
                FROM conventions 
                ORDER BY created_at DESC 
                LIMIT 3;
            `;
        }

        const res = await client.query(query);
        console.table(res.rows);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        client.release();
        pool.end();
    }
}
runInspection();
