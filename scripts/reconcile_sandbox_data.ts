
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL is not defined in .env.local");
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function reconcile() {
    const client = await pool.connect();
    try {
        console.log("🔄 Starting Reconciliation (X -> Z)...");
        await client.query('BEGIN');

        // 1. Move Students X -> Z
        const moveRes = await client.query(`
            UPDATE users 
            SET establishment_uai = '9999999Z' 
            WHERE establishment_uai = '9999999X'
            RETURNING uid;
        `);
        console.log(`✅ Moved ${moveRes.rowCount} users from 9999999X to 9999999Z.`);

        // 2. Delete Ghost Establishment X
        const delRes = await client.query(`
            DELETE FROM establishments 
            WHERE uai = '9999999X';
        `);
        console.log(`✅ Deleted Ghost Establishment 9999999X (Rows: ${delRes.rowCount}).`);

        // 3. Confirm/Fix Admin User
        const adminEmail = 'fabrice.dumasdelage@gmail.com';
        const adminRes = await client.query(`
            UPDATE users 
            SET establishment_uai = '9999999Z',
                role = 'school_head' -- Ensure role is correct too
            WHERE email = $1
            RETURNING uid, establishment_uai;
        `, [adminEmail]);

        if (adminRes.rowCount > 0) {
            console.log(`✅ Admin ${adminEmail} confirmed linked to ${adminRes.rows[0].establishment_uai}.`);
        } else {
            console.warn(`⚠️ Admin ${adminEmail} not found in DB!`);
        }

        await client.query('COMMIT');
        console.log("🎉 Reconciliation Complete.");

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("❌ Reconciliation Failed:", error);
    } finally {
        client.release();
        await pool.end();
    }
}

reconcile();
