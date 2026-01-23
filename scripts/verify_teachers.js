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
        const UAI = '9999999X';
        console.log(`Checking teachers for UAI: ${UAI}`);

        const res = await client.query(`
            SELECT count(*) as count 
            FROM users 
            WHERE establishment_uai = $1 AND role = 'teacher'
        `, [UAI]);

        console.log(`Teacher Count: ${res.rows[0].count}`);

        const sample = await client.query(`
            SELECT first_name, last_name, email, class_id 
            FROM users 
            WHERE establishment_uai = $1 AND role = 'teacher' 
            LIMIT 5
        `, [UAI]);

        console.log('Sample Teachers:', sample.rows);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.end();
    }
}

main();
