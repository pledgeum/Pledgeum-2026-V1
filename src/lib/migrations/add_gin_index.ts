import dotenv from 'dotenv';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function addGinIndex() {
    // Dynamic import to ensure env vars are loaded BEFORE pg.ts is evaluated
    const { default: pool } = await import('@/lib/pg');

    const client = await pool.connect();
    try {
        console.log('Adding GIN index on conventions(metadata)...');
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_conventions_metadata 
            ON conventions USING GIN (metadata);
        `);
        console.log('GIN index created successfully.');
    } catch (err) {
        console.error('Error creating GIN index:', err);
    } finally {
        client.release();
        // Allow script to exit cleanly
        await pool.end();
    }
}

addGinIndex();
