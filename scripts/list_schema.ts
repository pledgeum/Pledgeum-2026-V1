import dotenv from 'dotenv';
import path from 'path';
import { Pool } from 'pg';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const connectionConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
};

const pool = new Pool(connectionConfig);

async function listColumns(tableName: string) {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = $1;
        `, [tableName]);
        console.log(`Columns for table '${tableName}':`);
        res.rows.forEach(row => console.log(`- ${row.column_name} (${row.data_type})`));
    } catch (e) {
        console.error(`Error listing columns for ${tableName}:`, e);
    } finally {
        client.release();
    }
}

async function run() {
    await listColumns('conventions');
    await listColumns('users');
    await pool.end();
}

run().catch(console.error);
