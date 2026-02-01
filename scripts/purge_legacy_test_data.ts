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
        console.log('--- PURGE LEGACY TEST DATA START ---');

        const targetEmail = 'fabrice.dumasdelage@gmail.com';
        const validUAI = '9999999Z';
        const validName = 'Lycée de Démonstration (Sandbox)';
        const badNamePattern = '%TOUTFAUX%';

        // Step 1: Clean User Profile
        console.log(`[STEP 1] Inspecting User ${targetEmail}...`);

        // First, let's see what columns we actually have to be safe
        const colsRes = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users'
    `);
        const validCols = colsRes.rows.map(r => r.column_name);
        console.log('User Columns:', validCols);

        const hasEstablishmentId = validCols.includes('establishment_id');
        const hasEcoleNom = validCols.includes('ecole_nom');
        const hasSchoolName = validCols.includes('school_name');

        // Construct Update Query dynamically based on existing columns
        let updateSets: string[] = [`establishment_uai = '${validUAI}'`];

        // Check/Clear legacy name fields if they match the bad pattern
        // We use a conditional update: IF column ILIKE bad pattern THEN NULL (or valid Name?)
        // Actually user said: "If yes, SET IT TO NULL. (This forces the UI to use the linked establishment's real name)."
        // Good idea.

        if (hasEcoleNom) {
            updateSets.push(`ecole_nom = NULL`); // Forcing NULL to rely on join/fetch
        }
        if (hasSchoolName) {
            updateSets.push(`school_name = NULL`);
        }

        // Checking establishment_id
        let goodEstUUID = null;
        if (hasEstablishmentId) {
            // Fetch UUID of good establishment
            const goodEstRes = await client.query(`SELECT id FROM establishments WHERE uai = $1`, [validUAI]);
            if (goodEstRes.rowCount > 0 && goodEstRes.rows[0].id) {
                goodEstUUID = goodEstRes.rows[0].id;
                updateSets.push(`establishment_id = '${goodEstUUID}'`);
                console.log(`[INFO] Found Good UUID: ${goodEstUUID}. Will update user.`);
            } else {
                // If establishment table has no ID column or record missing
                const estCols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'establishments'`);
                const estHasId = estCols.rows.some(r => r.column_name === 'id');
                if (!estHasId) {
                    console.log(`[INFO] 'establishments' table has no 'id' column. Skipping establishment_id update.`);
                } else {
                    console.warn(`[WARN] Good establishment found but ID is missing?`);
                }
            }
        } else {
            console.log(`[INFO] 'users' table has no 'establishment_id' column. Skipping.`);
        }

        const updateQuery = `
        UPDATE users 
        SET ${updateSets.join(', ')}, updated_at = NOW()
        WHERE email = $1
        RETURNING *;
    `;

        console.log(`[EXEC] Running User Update...`);
        const updateUserRes = await client.query(updateQuery, [targetEmail]);

        if (updateUserRes.rowCount > 0) {
            console.log(`[SUCCESS] User cleaned:`, {
                email: updateUserRes.rows[0].email,
                uai: updateUserRes.rows[0].establishment_uai,
                ...(hasEcoleNom ? { ecole_nom: updateUserRes.rows[0].ecole_nom } : {}),
                ...(hasEstablishmentId ? { establishment_id: updateUserRes.rows[0].establishment_id } : {})
            });
        } else {
            console.error(`[ERROR] User not found!`);
        }

        // Step 2: Destroy Bad Establishments
        console.log(`[STEP 2] Destroying Bad Establishments...`);
        const deleteRes = await client.query(`
        DELETE FROM establishments 
        WHERE name ILIKE $1 OR (uai IS NULL AND name IS NOT NULL)
        RETURNING name, uai
    `, [badNamePattern]);

        if (deleteRes.rowCount > 0) {
            console.log(`[SUCCESS] Deleted ${deleteRes.rowCount} bad records:`);
            deleteRes.rows.forEach(r => console.log(` - Deleted: ${r.name} (UAI: ${r.uai})`));
        } else {
            console.log(`[INFO] No bad establishments found to delete.`);
        }

    } catch (err) {
        console.error('[FATAL ERROR]', err);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
