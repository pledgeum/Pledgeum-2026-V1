const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

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

        console.log("🛠️  FIXING SANDBOX RELATIONS...");

        // 1. Fix User 'pledgeum@gmail.com' (UID: 5CnHIaIE5XVwaPDjl4UknUx6eHi2)
        // Ensure it exists and has correct Role/Email
        const targetUid = '5CnHIaIE5XVwaPDjl4UknUx6eHi2';
        const targetEmail = 'pledgeum@gmail.com';

        console.log(`🔹 Updating User ${targetUid}...`);
        await client.query(`
            INSERT INTO users (uid, email, role, first_name, last_name)
            VALUES ($1, $2, 'school_head', 'Fabrice', 'Dumasdelage')
            ON CONFLICT (uid) DO UPDATE 
            SET email = $2, role = 'school_head'
        `, [targetUid, targetEmail]);
        console.log("✅ User updated/restored.");

        // 2. Fix Establishment '9999999X' Admin
        // Link it to pledgeum@gmail.com
        console.log(`🔹 Linking Establishment 9999999X to ${targetEmail}...`);
        await client.query(`
            UPDATE establishments 
            SET admin_email = $1
            WHERE uai = '9999999X'
        `, [targetEmail]);
        console.log("✅ Establishment updated.");

        // 3. Fix Conventions Link (Just in case)
        // Ensure all conventions for this user are attached to 9999999X
        console.log(`🔹 Attaching user's conventions to Sandbox...`);
        const res = await client.query(`
            UPDATE conventions
            SET establishment_uai = '9999999X'
            WHERE student_uid = $1
        `, [targetUid]);
        console.log(`✅ ${res.rowCount} conventions updated.`);

        // 4. Verification Dump
        const check = await client.query("SELECT * FROM establishments WHERE uai = '9999999X'");
        console.log("🔍 Final State (Sandbox):", check.rows[0]);

    } catch (err) {
        console.error("❌ Error:", err);
    } finally {
        await client.end();
    }
}

main();
