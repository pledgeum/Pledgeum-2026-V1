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
        const targetEmail = 'fabrice.dumasdelage@gmail.com';
        const targetUAI = '9999999Z';
        const targetName = 'Lycée de Démonstration (Sandbox)';

        console.log(`[FIX] Finding user: ${targetEmail}`);
        const userRes = await client.query('SELECT * FROM users WHERE email = $1', [targetEmail]);

        if ((userRes.rowCount || 0) === 0) {
            console.error(`[ERROR] User not found: ${targetEmail}`);
            return;
        }

        const user = userRes.rows[0];
        console.log('[DEBUG] User record:', user);

        let establishmentId = user.establishment_id;

        if (!establishmentId) {
            console.log(`[WARN] User has no establishment_id. Searching for establishment link...`);

            // Try searching by UAI or Name
            // The user says the name is "Mon LYCEE TOUTFAUX"
            const potentialNames = ['Mon LYCEE TOUTFAUX', 'Lycée de Démonstration (Sandbox)', 'Lycée de Démonstration'];

            let estRes = await client.query('SELECT * FROM establishments WHERE uai = $1', [targetUAI]);

            if ((estRes.rowCount || 0) === 0) {
                console.log(`[INFO] No establishment found with UAI ${targetUAI}. Searching by name...`);
                for (const name of potentialNames) {
                    estRes = await client.query('SELECT * FROM establishments WHERE name ILIKE $1', [name]); // Case insensitive
                    if ((estRes.rowCount || 0) > 0) {
                        console.log(`[FIX] Found establishment by name: "${name}"`);
                        break;
                    }
                }
            }

            if ((estRes.rowCount || 0) > 0) {
                establishmentId = estRes.rows[0].id;
                console.log(`[FIX] Linking user to found establishment ID: ${establishmentId}`);
                await client.query('UPDATE users SET establishment_id = $1 WHERE email = $2', [establishmentId, targetEmail]);
            } else {
                console.error(`[ERROR] Creating new establishment is risky without more info. Could not find "Mon LYCEE TOUTFAUX" or UAI ${targetUAI}.`);
                // Optional: Create if absolutely missing?
                // For now, let's stop and report if not found.
                return;
            }
        }

        console.log(`[FIX] Updating Establishment ID: ${establishmentId}`);

        // Update the Establishment
        const updateRes = await client.query(
            `UPDATE establishments
       SET uai = $1, name = $2
       WHERE id = $3
       RETURNING id, uai, name`,
            [targetUAI, targetName, establishmentId]
        );

        if ((updateRes.rowCount || 0) > 0) {
            console.log(`[SUCCESS] Establishment updated:`, updateRes.rows[0]);
        } else {
            console.error(`[ERROR] Failed to update establishment. It might not exist in the table?`);
        }

    } catch (err) {
        console.error('[FATAL]', err);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
