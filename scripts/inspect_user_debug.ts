import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function main() {
    const client = await pool.connect();
    try {
        console.log('--- INSPECT USER DATA ---');
        const email = 'fabrice.dumasdelage@gmail.com';

        const res = await client.query('SELECT uid, email, establishment_uai, role FROM users WHERE email = $1', [email]);

        if (res.rowCount === 0) {
            console.log('User not found in DB.');
        } else {
            console.log('User found:', res.rows[0]);
        }
    } catch (err) {
        console.error(err);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
