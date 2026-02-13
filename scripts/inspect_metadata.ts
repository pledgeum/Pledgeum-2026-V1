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

async function inspect() {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT id, metadata 
            FROM conventions 
            ORDER BY created_at DESC 
            LIMIT 1;
        `);

        if (res.rows.length > 0) {
            console.log("Most recent convention metadata keys:");
            console.log(Object.keys(res.rows[0].metadata));
            console.log("Metadata content:", JSON.stringify(res.rows[0].metadata, null, 2));
        } else {
            console.log("No conventions found.");
        }
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

inspect().catch(console.error);
