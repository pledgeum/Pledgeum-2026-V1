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
        console.log("🚀 Starting Diploma & Legal Rep Migration...");

        // 1. Add Columns
        await client.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS diploma_prepared TEXT,
            ADD COLUMN IF NOT EXISTS legal_representatives JSONB DEFAULT '[]'::jsonb;
        `);
        console.log("✅ Columns `diploma_prepared` and `legal_representatives` added (if not exists).");

    } catch (err) {
        console.error("❌ Migration Failed:", err);
    } finally {
        await client.end();
    }
}

main();
