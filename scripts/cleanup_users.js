const { Pool } = require('pg');

// Parse connection string from environment or hardcoded fallback (User didn't provide .env, checking known config or assuming localhost)
// Actually, I can't easily read .env in this environment without `source`.
// But I can try to read `src/lib/pg.ts` to see how it connects, or just assume standard Next.js env vars are loaded if I run with `dotenv`.
// I'll try to use the existing `migrate_to_postgres.js` pattern if it exists, as seen in open files.
// Wait, `scripts/migrate_to_postgres.js` is open. Let's read it to see how it connects.

// Check if I can see `migrate_to_postgres.js` content.
// Ideally I should strictly use `run_command` to run a script that imports `lib/pg` if possible, but `lib/pg` is TS.
// I'll write a standalone JS script with hardcoded credentials if I can find them, or assume they are in env.
// Let's assume env vars are set in the terminal session or `.env.local`.
// I will try to read `.env.local` first to get the connection string? 
// No, I shouldn't read secrets if I can avoid it.
// I'll assume `process.env.POSTGRES_URL` is available or valid.

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/convention_pfmp';

const pool = new Pool({
    connectionString,
});

async function cleanup() {
    console.log('Connecting to DB...');
    const client = await pool.connect();
    try {
        console.log('Running cleanup...');
        const res = await client.query(`
      DELETE FROM users 
      WHERE role != 'school_head' 
      AND email NOT IN ('pledgeum@gmail.com', 'admin@pledgeum.fr');
    `);
        console.log(`Deleted ${res.rowCount} users.`);

        // Also optional: cleanup orphan classes? User didn't ask explicitly but "Nettoyage des Données". 
        // User said "users table". I'll stick to users.

    } catch (err) {
        console.error('Error:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

cleanup();
