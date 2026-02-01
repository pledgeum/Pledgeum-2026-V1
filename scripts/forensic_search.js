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

        // 1. List Tables
        console.log("\n📊 Tables in Public Schema:");
        const tablesRes = await client.query(`
            SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
        `);
        console.log(tablesRes.rows.map(r => r.table_name));

        // 2. Dump Users
        console.log("\n👤 First 5 Users (Generic Dump):");
        const usersRes = await client.query('SELECT * FROM users LIMIT 5');
        console.log(usersRes.rows);

        // 3. Search for Specific String 'BERTTYME632'
        const searchStr = 'BERTTYME632';
        console.log(`\n🔍 Searching for '${searchStr}' in 'users' table...`);

        // Naive search in text columns
        // We catch strict match or substring
        const searchRes = await client.query(`
            SELECT * FROM users 
            WHERE 
                uid::text LIKE $1 OR
                email::text LIKE $1 OR
                temp_id::text LIKE $1 OR
                temp_code::text LIKE $1 OR
                last_name::text LIKE $1 OR
                password_hash::text LIKE $1
        `, [`%${searchStr}%`]);

        if (searchRes.rowCount > 0) {
            console.log("✅ FOUND IT! Here is the record:");
            console.log(searchRes.rows[0]);
        } else {
            console.log("❌ Not found in 'users' common columns.");
        }

    } catch (err) {
        console.error("❌ Error:", err);
    } finally {
        await client.end();
    }
}

main();
