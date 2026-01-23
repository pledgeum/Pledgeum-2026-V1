const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!connectionString) {
    console.error("Error: DATABASE_URL or POSTGRES_URL not found in .env.local");
    process.exit(1);
}

const pool = new Pool({
    connectionString: connectionString,
});

async function setupConstraints() {
    const client = await pool.connect();
    try {
        console.log('[SETUP] Enabling "unaccent" extension...');
        await client.query('CREATE EXTENSION IF NOT EXISTS unaccent');

        console.log('[SETUP] Creating "immutable_unaccent" wrapper function...');
        // We wrap unaccent to make it immutable (required for indexes)
        // We specify the dictionary 'unaccent' explicitly to be safe
        await client.query(`
        CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
        RETURNS text AS
        $func$
        SELECT public.unaccent('public.unaccent', $1)
        $func$  LANGUAGE sql IMMUTABLE;
    `);

        console.log('[SETUP] Creating Unique Index "idx_users_unique_triplet"...');
        // Dropping first to be safe
        await client.query('DROP INDEX IF EXISTS idx_users_unique_triplet');

        // Creating the index using the immutable wrapper
        await client.query(`
        CREATE UNIQUE INDEX idx_users_unique_triplet 
        ON users (upper(public.immutable_unaccent(last_name)), upper(public.immutable_unaccent(first_name)), birth_date) 
        WHERE role = 'student'
    `);

        console.log('[SETUP] Index created successfully.');

    } catch (err) {
        console.error('[SETUP] Error:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

setupConstraints();
