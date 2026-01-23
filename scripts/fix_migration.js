
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

async function migrate() {
    const client = await pool.connect();
    try {
        console.log("Adding main_teacher_id column...");
        await client.query(`
            ALTER TABLE classes 
            ADD COLUMN IF NOT EXISTS main_teacher_id VARCHAR(255);
        `);
        console.log("Column added successfully.");

        // Verify
        const res = await client.query(`
             SELECT column_name 
             FROM information_schema.columns 
             WHERE table_name = 'classes' AND column_name = 'main_teacher_id';
        `);
        console.log("Verification:", res.rows);

    } catch (err) {
        console.error("Migration Failed:", err);
    } finally {
        client.release();
        pool.end();
    }
}

migrate();
