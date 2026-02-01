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
        console.log("🚀 Starting Address Columns Migration...");

        // 1. Add Columns
        await client.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS zip_code TEXT,
            ADD COLUMN IF NOT EXISTS city TEXT;
        `);
        console.log("✅ Columns `zip_code` and `city` added (if not exists).");

        // 2. Data Backfill Strategy (Optional but helpful)
        console.log("🔄 Attempting smart backfill from `address` column...");

        const res = await client.query("SELECT uid, address FROM users WHERE address IS NOT NULL AND (zip_code IS NULL OR city IS NULL)");
        console.log(`Found ${res.rowCount} users to process.`);

        let updatedCount = 0;

        for (const user of res.rows) {
            const addr = user.address.trim();
            // Regex to find 5 digits followed by text at the end
            // "12 Rue Example 75000 Paris" -> zip: 75000, city: Paris
            const match = addr.match(/(\d{5})\s+(.+)$/);

            if (match) {
                const zip = match[1];
                const city = match[2];
                // Optional: Extract street by removing zip+city from end
                // const street = addr.substring(0, match.index).trim();

                await client.query(`
                    UPDATE users 
                    SET zip_code = $1, city = $2
                    WHERE uid = $3
                `, [zip, city, user.uid]);
                updatedCount++;
            }
        }

        console.log(`✅ Backfill complete. Updated ${updatedCount} users.`);

    } catch (err) {
        console.error("❌ Migration Failed:", err);
    } finally {
        await client.end();
    }
}

main();
