
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
        console.log("--- MIGRATING CONVENTIONS TABLE ---");

        // Add columns for Signature Workflow
        await client.query(`
            ALTER TABLE conventions
            ADD COLUMN IF NOT EXISTS pdf_hash VARCHAR(64),
            ADD COLUMN IF NOT EXISTS token_company VARCHAR(64),
            ADD COLUMN IF NOT EXISTS token_school VARCHAR(64),
            ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ, -- PP Validation
            ADD COLUMN IF NOT EXISTS signature_company_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS signature_school_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
        `);

        // Add indexes for tokens (lookup performance)
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_conventions_token_company ON conventions(token_company);
            CREATE INDEX IF NOT EXISTS idx_conventions_token_school ON conventions(token_school);
        `);

        console.log("✅ Schema updated successfully.");

        // Verification
        const res = await client.query(`
             SELECT column_name, data_type 
             FROM information_schema.columns 
             WHERE table_name = 'conventions'
             ORDER BY ordinal_position;
        `);
        console.table(res.rows.map(r => ({ COL: r.column_name, TYPE: r.data_type })));

    } catch (err) {
        console.error("Migration Failed:", err);
    } finally {
        client.release();
        pool.end();
    }
}

migrate();
