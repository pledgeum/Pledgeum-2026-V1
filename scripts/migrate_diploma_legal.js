const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('Starting migration for AttestationPFMP dual calculation...');

        // 1. Add new columns
        await client.query(`
      ALTER TABLE attestations 
      ADD COLUMN IF NOT EXISTS total_days_paid NUMERIC DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_weeks_diploma INTEGER DEFAULT 0;
    `);

        // 2. Map existing data (conservative mapping)
        await client.query(`
      UPDATE attestations 
      SET 
        total_days_paid = total_days_present,
        total_weeks_diploma = CEIL(total_days_present / 5.0)
      WHERE total_days_paid = 0 AND total_days_present > 0;
    `);

        // 3. Drop old column 
        // WARNING: We keep it for safety during transition or just drop it? 
        // User said "replace", but let's just leave it for now or drop if sure.
        // await client.query('ALTER TABLE attestations DROP COLUMN total_days_present;');

        console.log('Migration successful!');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
