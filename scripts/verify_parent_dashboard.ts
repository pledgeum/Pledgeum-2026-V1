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
const PARENT_EMAIL = 'fabrice.dumasdelage@proton.me';

async function verify() {
    const client = await pool.connect();
    try {
        console.log(`Verifying Dashboard Query for: ${PARENT_EMAIL}`);

        const queryStr = `
            SELECT 
                c.id,
                c.status,
                c.metadata->>'rep_legal_email' as "legalRepEmail",
                c.student_uid
            FROM conventions c
            WHERE LOWER(c.metadata->>'rep_legal_email') = LOWER($1)
            ORDER BY c.updated_at DESC
        `;

        const res = await client.query(queryStr, [PARENT_EMAIL]);

        if (res.rows.length > 0) {
            console.log(`✅ Success! Found ${res.rows.length} convention(s) for this parent.`);
            res.rows.forEach(row => {
                console.log(`- Convention ID: ${row.id}, Status: ${row.status}, Student: ${row.student_uid}`);
            });
        } else {
            console.error("❌ No conventions found. The query logic might be wrong or data is missing.");
        }

    } catch (e) {
        console.error("Verification failed:", e);
    } finally {
        client.release();
        await pool.end();
    }
}

verify().catch(console.error);
