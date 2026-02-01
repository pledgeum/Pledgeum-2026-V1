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
    const targetEmail = 'fabrice.dumasdelage@yahoo.fr';

    try {
        await client.connect();
        console.log(`🔍 Auditing User: ${targetEmail}`);

        // 1. Get User Data
        const userRes = await client.query(`
            SELECT uid, email, role, birth_date, class_id, establishment_uai 
            FROM users 
            WHERE email = $1
        `, [targetEmail]);

        if (userRes.rows.length === 0) {
            console.error("❌ User not found in DB!");
            return;
        }

        const user = userRes.rows[0];
        console.log("✅ User Found:");
        console.table(user);

        // Check columns specifically
        console.log("- birth_date is:", user.birth_date, `(Type: ${typeof user.birth_date})`);
        console.log("- class_id is:", user.class_id);

        if (!user.class_id) {
            console.warn("⚠️ class_id is NULL. No class linked.");
        } else {
            // 2. key Check: Class Name
            const classRes = await client.query(`
                SELECT id, name, establishment_uai 
                FROM classes 
                WHERE id = $1
            `, [user.class_id]);

            if (classRes.rows.length === 0) {
                console.error("❌ Class ID exists in User, but NOT found in classes table (Orphan Link)!");
            } else {
                console.log("✅ Class Found:");
                console.table(classRes.rows[0]);
            }
        }

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.end();
    }
}

main();
