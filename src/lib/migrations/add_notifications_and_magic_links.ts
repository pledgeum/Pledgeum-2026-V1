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
        console.log('Beginning migration: add_notifications_and_magic_links...');

        await client.query('BEGIN');

        // 1. Create notification_logs table
        console.log('Creating notification_logs table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS notification_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                recipient_email TEXT NOT NULL,
                subject TEXT NOT NULL,
                status TEXT NOT NULL CHECK (status IN ('SENT', 'FAILED')),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                meta_data JSONB
            );
        `);

        // 2. Create magic_link_tokens table
        console.log('Creating magic_link_tokens table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS magic_link_tokens (
                token TEXT PRIMARY KEY,
                convention_id TEXT NOT NULL,
                role TEXT NOT NULL,
                email TEXT NOT NULL,
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                used_at TIMESTAMP WITH TIME ZONE
            );
        `);

        // 3. Add Index for faster token lookup
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_created_at ON magic_link_tokens(created_at);
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
