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

        console.log("--- DEBUGGING SANDBOX/PLEDGEUM VISIBILITY ---");

        // 1. Check Use 'pledgeum@gmail.com'
        console.log("\n1. USER CHECK (pledgeum@gmail.com):");
        const userRes = await client.query("SELECT uid, email, role FROM users WHERE email = 'pledgeum@gmail.com' OR email = 'fabrice.dumasdelage@gmail.com'");
        console.table(userRes.rows);

        // 2. Check Conventions for these users
        console.log("\n2. CONVENTION CHECK (linked to these users):");
        if (userRes.rowCount > 0) {
            const uids = userRes.rows.map(r => `'${r.uid}'`).join(",");
            const convRes = await client.query(`
                SELECT id, student_uid, establishment_uai, status 
                FROM conventions 
                WHERE student_uid IN (${uids})
            `);
            console.table(convRes.rows);
        } else {
            console.log("No users found.");
        }

        // 3. Check Establishment '9999999X'
        console.log("\n3. ESTABLISHMENT CHECK (9999999X):");
        const estabRes = await client.query("SELECT * FROM establishments WHERE uai = '9999999X'");
        console.table(estabRes.rows);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.end();
    }
}

main();
