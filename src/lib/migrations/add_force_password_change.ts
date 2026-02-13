
import pool from '@/lib/pg';

async function migrate() {
    console.log('Running migration: Add must_change_password column to users table...');
    const client = await pool.connect();
    try {
        await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;
    `);
        console.log('Migration successful: must_change_password column ensured.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        client.release();
        // Force close pool to exit script
        await pool.end();
    }
}

migrate();
