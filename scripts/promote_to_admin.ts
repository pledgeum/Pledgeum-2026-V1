import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function promoteToAdmin() {
    const client = await pool.connect();
    try {
        console.log('--- PROMOTING USER TO ESTABLISHMENT_ADMIN ---');

        const email = 'fabrice.dumasdelage@gmail.com';
        const targetRole = 'ESTABLISHMENT_ADMIN';
        const targetUai = '9999999Z';

        console.log(`Checking if school ${targetUai} exists...`);
        const schoolRes = await client.query('SELECT name FROM establishments WHERE uai = $1', [targetUai]);
        if (schoolRes.rows.length === 0) {
            console.error(`Error: School with UAI ${targetUai} not found. Please run seed script first.`);
            return;
        }
        console.log(`School found: ${schoolRes.rows[0].name}`);

        console.log(`Updating user ${email}...`);
        const res = await client.query(`
            UPDATE users 
            SET role = $1, establishment_uai = $2, updated_at = NOW()
            WHERE email = $3
            RETURNING email, role, establishment_uai
        `, [targetRole, targetUai, email]);

        if (res.rows.length > 0) {
            console.log(`SUCCESS: User ${res.rows[0].email} role updated to ${res.rows[0].role} (School: ${res.rows[0].establishment_uai})`);
        } else {
            console.error(`ERROR: User ${email} not found.`);
        }

    } catch (err) {
        console.error('Promotion failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

promoteToAdmin();
