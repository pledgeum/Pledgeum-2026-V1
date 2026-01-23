const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load .env.local
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        await client.connect();

        console.log("🛠️  Adding 'establishment_uai' to users...");
        await client.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS establishment_uai VARCHAR(8);
        `);
        console.log("✅ Column added.");

        console.log("🛠️  Creating UNIQUE Index (Triplet + UAI)...");
        // We use COALESCE to handle nulls if necessary, but here we assume strict constraints for the index work best on non-nulls.
        // However, existing data might be null. 
        // We might need to fill it first?
        // Let's create it as partial index or just create it. 
        // Postgres Unique Index allows multiple NULLs (distinct). 
        // But for the triplet logic, we want uniqueness.

        // Note: birth_date is Date.
        await client.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_users_unique_triplet 
            ON users (UPPER(last_name), UPPER(first_name), birth_date, establishment_uai);
        `);
        console.log("✅ Index created.");

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.end();
    }
}

main();
