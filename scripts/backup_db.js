const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load env
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

const BACKUP_FILE = path.resolve(__dirname, '../data/backup/backup_pre_migration_Jan23.sql');

async function dumpDatabase() {
    try {
        await client.connect();
        console.log("✅ Connected to PostgreSQL");

        // Get all tables
        const res = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        `);

        const tables = res.rows.map(r => r.table_name);
        console.log(`Found ${tables.length} tables to backup: ${tables.join(', ')}`);

        let sqlContent = `-- Backup generated on ${new Date().toISOString()}\n\n`;

        for (const table of tables) {
            console.log(`📦 Dumping table: ${table}...`);

            // Get data
            const dataRes = await client.query(`SELECT * FROM "${table}"`);
            const rows = dataRes.rows;

            if (rows.length === 0) {
                sqlContent += `-- Table: ${table} (Empty)\n`;
                sqlContent += `TRUNCATE TABLE "${table}" CASCADE;\n\n`;
                continue;
            }

            // Generate INSERT statements
            sqlContent += `-- Table: ${table} (${rows.length} rows)\n`;
            sqlContent += `TRUNCATE TABLE "${table}" CASCADE;\n`;

            const columns = Object.keys(rows[0]).map(c => `"${c}"`).join(', ');

            for (const row of rows) {
                const values = Object.values(row).map(val => {
                    if (val === null) return 'NULL';
                    if (typeof val === 'number') return val;
                    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
                    if (val instanceof Date) return `'${val.toISOString()}'`;
                    if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`; // JSON columns
                    // String escaping
                    return `'${val.toString().replace(/'/g, "''")}'`;
                }).join(', ');

                sqlContent += `INSERT INTO "${table}" (${columns}) VALUES (${values});\n`;
            }
            sqlContent += `\n`;
        }

        fs.writeFileSync(BACKUP_FILE, sqlContent);
        console.log(`✅ Backup saved to: ${BACKUP_FILE}`);
        console.log(`📊 Total size: ${(fs.statSync(BACKUP_FILE).size / 1024 / 1024).toFixed(2)} MB`);

    } catch (err) {
        console.error("❌ Backup failed:", err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

dumpDatabase();
