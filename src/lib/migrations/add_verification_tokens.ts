import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Dynamic import to avoid build-time issues with missing env vars
const getPool = async () => {
    const { default: pool } = await import('../pg');
    return pool;
};

async function runMigration() {
    const pool = await getPool();
    const client = await pool.connect();

    try {
        console.log('Beginning migration: add_verification_tokens...');

        await client.query('BEGIN');

        // Create verification_tokens table
        console.log('Creating verification_tokens table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS verification_tokens (
                identifier TEXT NOT NULL, -- The user's email
                token TEXT NOT NULL,      -- The secure random token
                expires TIMESTAMPTZ NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE(identifier, token)
            );
        `);

        // Index for faster cleanup/lookup
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_verification_tokens_expires ON verification_tokens(expires);
        `);

        await client.query('COMMIT');
        console.log('Migration completed successfully.');

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', e);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration().catch(console.error);
