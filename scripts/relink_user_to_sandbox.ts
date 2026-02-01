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
        console.log('--- DATABASE REPAIR: RELINK USER TO SANDBOX ---');

        const targetEmail = 'fabrice.dumasdelage@gmail.com';
        const goodUAI = '9999999Z';

        // 1. Fetch Good Establishment
        console.log(`[STEP 1] Fetching Good Establishment (UAI: ${goodUAI})...`);
        const goodEstRes = await client.query('SELECT * FROM establishments WHERE uai = $1', [goodUAI]);

        if (goodEstRes.rowCount === 0) {
            console.error(`[FATAL] Good Establishment (9999999Z) NOT FOUND! Aborting.`);
            return;
        }

        // Check if ID column exists on establishments (It might not based on previous audit, but let's see)
        // Actually, Step 3156 showed establishment schema: `uai, name` ... wait, Step 3150 showed `establishments` has NO `id` column?
        // Step 3150 output:
        // TABLE: establishments
        //   - uai (character varying)
        //   - name (character varying)
        // ...
        //   - created_at
        //   - updated_at
        // IT HAS NO 'id' COLUMN! The Primary Key is likely 'uai'.

        console.log(`[INFO] Good Establishment Found: "${goodEstRes.rows[0].name}"`);

        // 2. Update User
        console.log(`[STEP 2] Updating User ${targetEmail}...`);
        // Note: 'users' table DOES NOT have 'establishment_id' either (Step 3150).
        // So we ONLY update 'establishment_uai'.

        const updateUserRes = await client.query(
            `UPDATE users 
         SET establishment_uai = $1 
         WHERE email = $2 
         RETURNING email, establishment_uai`,
            [goodUAI, targetEmail]
        );

        if (updateUserRes.rowCount === 0) {
            console.error(`[ERROR] User not found: ${targetEmail}`);
        } else {
            console.log(`[SUCCESS] User updated:`, updateUserRes.rows[0]);
        }

        // 3. Cleanup Bad Establishment
        console.log(`[STEP 3] Cleaning up Bad Establishments...`);
        // Find establishments named like '%TOUTFAUX%' or with NULL UAI
        const badEstRes = await client.query(
            `SELECT * FROM establishments WHERE name ILIKE '%TOUTFAUX%' OR uai IS NULL`
        );

        if (badEstRes.rowCount === 0) {
            console.log(`[INFO] No Bad Establishments found.`);
        } else {
            console.log(`[INFO] Found ${badEstRes.rowCount} Bad Establishment(s):`);
            badEstRes.rows.forEach(r => console.log(` - ${r.name} (UAI: ${r.uai})`));

            // Delete them
            // If UAI is PK, we delete by UAI (handling nulls is tricky if PK doesn't allow nulls, 
            // but if they exist with null UAI, then UAI isn't PK or constraint is lax).
            // If no ID exists, we must delete by NAME or UAI match.

            // We delete by exact row match ideally, but let's delete by the criteria we found them with.
            const deleteRes = await client.query(
                `DELETE FROM establishments WHERE name ILIKE '%TOUTFAUX%' OR uai IS NULL RETURNING *`
            );
            console.log(`[SUCCESS] Deleted ${deleteRes.rowCount} Bad Establishment(s).`);
        }

    } catch (err) {
        console.error('[FATAL REPAIR ERROR]', err);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
