import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function auditUser() {
    const client = await pool.connect();
    try {
        console.log('--- AUDIT: Checking for user duplicates and roles ---');
        const emailToAudit = 'fabrice.dumasdelage@gmail.com';

        // Fetch all users to check for case-insensitive duplicates
        const res = await client.query('SELECT uid, email, role, establishment_uai as establishment_id, password_hash FROM users');

        const matches = res.rows.filter(row => row.email.toLowerCase() === emailToAudit.toLowerCase());

        if (matches.length === 0) {
            console.log(`No matches found for ${emailToAudit}`);
            return;
        }

        console.log(`Found ${matches.length} matches for ${emailToAudit}:`);
        matches.forEach((match, index) => {
            console.log(`\nMatch ${index + 1}:`);
            console.log(`ID: ${match.uid}`);
            console.log(`Email: ${match.email}`);
            console.log(`Role: ${match.role}`);
            console.log(`Establishment ID: ${match.establishment_id}`);
            console.log(`Password Hash (prefix): ${match.password_hash ? match.password_hash.substring(0, 10) : 'NULL'}`);
        });

    } catch (err) {
        console.error('Audit failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

auditUser();
