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
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        await client.connect();
        console.log("✅ PostgreSQL Connected.");

        console.log("Adding temp_id and temp_code columns...");

        await client.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS temp_id VARCHAR(50),
            ADD COLUMN IF NOT EXISTS temp_code VARCHAR(50);
        `);

        console.log("✅ Columns added.");

        console.log("Adding index on temp_id...");
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_users_temp_id ON users(temp_id);
        `);
        console.log("✅ Index created.");

    } catch (err) {
        console.error("❌ Error:", err);
    } finally {
        await client.end();
    }
}

main();
