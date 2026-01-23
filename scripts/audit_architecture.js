
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const config = {
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    ssl: { rejectUnauthorized: false }
};

const pool = new Pool(config);

async function audit() {
    const client = await pool.connect();
    try {
        const tables = ['establishments', 'classes', 'users', 'conventions'];

        for (const table of tables) {
            console.log(`\n--- TABLE: ${table} ---`);
            const res = await client.query(`
                SELECT 
                    column_name, 
                    data_type, 
                    character_maximum_length,
                    is_nullable
                FROM information_schema.columns 
                WHERE table_name = $1
                ORDER BY ordinal_position;
            `, [table]);

            if (res.rows.length === 0) {
                console.log("(Table does not exist)");
            } else {
                console.table(res.rows.map(r => ({
                    COLUMN: r.column_name,
                    TYPE: r.data_type + (r.character_maximum_length ? `(${r.character_maximum_length})` : ''),
                    NULLABLE: r.is_nullable
                })));
            }
        }

    } catch (err) {
        console.error("Audit Failed:", err);
    } finally {
        client.release();
        pool.end();
    }
}

audit();
