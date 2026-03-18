import pool from '@/lib/pg';

async function migrate() {
    console.log('Running migration: Add type column to conventions table...');
    const client = await pool.connect();
    try {
        await client.query(`
            ALTER TABLE conventions 
            ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'PFMP_STANDARD';
        `);
        console.log('Migration successful: type column added to conventions table.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
