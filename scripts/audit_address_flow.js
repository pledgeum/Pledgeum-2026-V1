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

        // 1. Check Table Structure
        console.log("🔍 Checking 'users' table columns...");
        const schemaRes = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users';
        `);

        const columns = schemaRes.rows.map(r => r.column_name);
        console.log("Found Columns:", columns.filter(c => c.includes('address') || c.includes('zip') || c.includes('city') || c.includes('postal')));

        // 2. Check Data
        console.log(`\n🔍 Checking Data for: ${targetEmail}`);
        // We select * because we don't know exact column names yet, catching duplicate error if we guess wrong
        // But we can filter dynamically based on columns found.

        const hasZip = columns.includes('zip_code');
        const hasPostal = columns.includes('postal_code');
        const hasCity = columns.includes('city');
        const hasAddress = columns.includes('address');

        const queryCols = ['uid', 'email', 'role'];
        if (hasAddress) queryCols.push('address');
        if (hasZip) queryCols.push('zip_code');
        if (hasPostal) queryCols.push('postal_code');
        if (hasCity) queryCols.push('city');

        const userRes = await client.query(`
            SELECT ${queryCols.join(', ')}
            FROM users 
            WHERE email = $1
        `, [targetEmail]);

        if (userRes.rows.length === 0) {
            console.error("❌ User not found!");
        } else {
            console.table(userRes.rows[0]);
        }

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.end();
    }
}

main();
