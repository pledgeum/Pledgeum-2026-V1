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
        console.log("🔍 Checking 'users' table for Diploma & Legal Rep columns...");

        const schemaRes = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users';
        `);

        const columns = schemaRes.rows.map(r => r.column_name);

        const relevantCols = columns.filter(c =>
            c.includes('diploma') ||
            c.includes('legacy') ||
            c.includes('legal') ||
            c.includes('repres') ||
            c.includes('parent')
        );

        if (relevantCols.length === 0) {
            console.log("❌ No explicit columns found for Diploma or Legal/Parent info.");
        } else {
            console.log("✅ Found potential columns:", relevantCols);
        }

        // Also check if `legal_representatives` JSON column exists (common pattern in this project)
        if (columns.includes('legal_representatives')) {
            console.log("✅ Found 'legal_representatives' column (likely JSONB).");
        } else {
            console.log("❌ Missing 'legal_representatives' column.");
        }

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.end();
    }
}

main();
