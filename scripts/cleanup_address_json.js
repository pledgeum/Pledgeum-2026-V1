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
        console.log("🚀 Starting Address JSON Cleanup...");

        // 1. Find users with JSON-like address
        const res = await client.query("SELECT uid, address FROM users WHERE address LIKE '{%'");
        console.log(`Found ${res.rowCount} users with potential JSON addresses.`);

        let updatedCount = 0;
        let errorCount = 0;

        for (const user of res.rows) {
            try {
                const parsed = JSON.parse(user.address);

                // We expect parsed object to have 'street', 'postalCode', 'city' etc.
                // The goal is to set the address column to just the street part.
                // We assume zip_code and city were likely handled or we should try to save them too if they are missing?
                // The user request specifically asks: "UPDATE the address column to contain only this extracted street string."
                // But let's be safe: if zip_code/city are empty in DB, maybe fill them from JSON too?

                // Let's check current zip/city for this user to be safe? 
                // Using a separate query might be slow for many users, but for cleanup it's fine.
                // Actually, let's just update address to parsed.street. 
                // The previous migration *might* have failed on JSON strings if the regex didn't match JSON structure.
                // So let's also update zip_code/city from JSON if they exist in JSON.

                const street = parsed.street || parsed.address || ''; // fallback if mixed keys
                const zip = parsed.zipCode || parsed.postalCode;
                const city = parsed.city;

                if (street) {
                    // Update address. Optionally update zip/city if we have them in JSON.
                    // We use COALESCE in SQL to only update zip/city if they are currently NULL?
                    // Or just overwrite? 
                    // Let's stick to the prompt: "UPDATE the address column to contain only this extracted street string."
                    // But if I strip the JSON, I lose zip/city if they weren't migrated!
                    // So I MUST ensure zip/city are saved.

                    await client.query(`
                        UPDATE users 
                        SET address = $1,
                            zip_code = COALESCE(zip_code, $2),
                            city = COALESCE(city, $3)
                        WHERE uid = $4
                    `, [street, zip, city, user.uid]);

                    updatedCount++;
                } else {
                    console.warn(`⚠️ JSON parsed but no 'street' field found for user ${user.uid}:`, user.address);
                }

            } catch (e) {
                console.error(`❌ Failed to parse JSON for user ${user.uid}:`, user.address, e.message);
                errorCount++;
            }
        }

        console.log(`✅ Cleanup complete. Updated: ${updatedCount}, Errors: ${errorCount}`);

    } catch (err) {
        console.error("❌ Cleanup Failed:", err);
    } finally {
        await client.end();
    }
}

main();
