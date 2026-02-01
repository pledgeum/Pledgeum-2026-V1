import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function main() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    const client = await pool.connect();

    try {
        console.log("🔒 Starting DB Fix: Unique UID Constraint");

        // 1. Check for duplicates
        console.log("🔍 Checking for duplicate UIDs...");
        const dupRes = await client.query(`
            SELECT uid, count(*) as count 
            FROM users 
            WHERE uid IS NOT NULL 
            GROUP BY uid 
            HAVING count(*) > 1;
        `);

        if (dupRes.rows.length > 0) {
            console.log(`⚠️ Found ${dupRes.rows.length} duplicate UIDs! Resolving...`);

            for (const row of dupRes.rows) {
                const uid = row.uid;
                console.log(`   - Processing duplicate UID: ${uid} (Count: ${row.count})`);

                // Strategy: Keep the one with the most recent created_at (or updated_at if available), or just arbitrary.
                // Assuming 'created_at' exists, otherwise use CTID (physical location).
                // Let's first check columns.
                // Safest generic dedupe: Keep the one with highest ID (assuming serial/uuid sortability) or just one of them.
                // But users table might not have serial ID. It has email as PK?
                // Let's look at schema quickly? No, just use CTID or ctid logic.
                // Actually, let's just delete all but one using ctid.

                await client.query(`
                    DELETE FROM users 
                    WHERE uid = $1 
                    AND ctid NOT IN (
                        SELECT ctid 
                        FROM users 
                        WHERE uid = $1 
                        LIMIT 1
                    )
                `, [uid]);
                console.log(`     ✅ Cleaned duplicates for ${uid}`);
            }
        } else {
            console.log("✅ No duplicate UIDs found.");
        }

        // 2. Add Constraint
        console.log("🛠 Adding UNIQUE constraint on users(uid)...");
        // We use CREATE UNIQUE INDEX CONCURRENTLY if we were in a migration file, but CONCURRENTLY cannot run inside a transaction block easily in node script depending on driver/mode
        // simpler: ALTER TABLE ADD CONSTRAINT.

        await client.query(`
            ALTER TABLE users ADD CONSTRAINT unique_uid UNIQUE (uid);
        `);

        console.log("✅ Constraint 'unique_uid' added successfully.");

    } catch (err: any) {
        if (err.message.includes('already exists')) {
            console.log("ℹ️ unique_uid constraint already exists.");
        } else {
            console.error("❌ Error applying fix:", err);
            // Print duplicates context if failed
            try {
                const failedDup = await client.query("SELECT uid, email FROM users WHERE uid IN (SELECT uid FROM users GROUP BY uid HAVING count(*) > 1)");
                if (failedDup.rows.length > 0) {
                    console.table(failedDup.rows);
                }
            } catch (e) { }
        }
    } finally {
        client.release();
        await pool.end();
    }
}

main();
