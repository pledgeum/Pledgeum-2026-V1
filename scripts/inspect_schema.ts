import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

// Manual env load
const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function main() {
    const client = await pool.connect();
    try {
        console.log('--- SCHEMA INSPECTION ---');

        const tables = ['users', 'establishments'];

        for (const table of tables) {
            console.log(`\nTABLE: ${table}`);
            const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = $1
            ORDER BY ordinal_position
        `, [table]);

            if (res.rowCount === 0) {
                console.log('  (Table not found or no columns)');
            } else {
                res.rows.forEach(row => {
                    console.log(`  - ${row.column_name} (${row.data_type})`);
                });
            }
        }

    } catch (err) {
        console.error('[FATAL ERROR]', err);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
