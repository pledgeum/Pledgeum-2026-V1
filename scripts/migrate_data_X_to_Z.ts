
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

async function main() {
    // 1. Load Env
    const envPath = path.resolve(__dirname, '../.env.local');
    if (fs.existsSync(envPath)) {
        console.log(`[SCRIPT] Loading env from ${envPath}`);
        const envConfig = dotenv.parse(fs.readFileSync(envPath));
        for (const k in envConfig) {
            process.env[k] = envConfig[k];
        }
    } else {
        console.warn("[SCRIPT] .env.local not found!");
    }

    // 2. Dynamic Import
    // @ts-ignore
    const { default: pool } = await import('../src/lib/pg');

    const sourceUAI = '9999999X';
    const targetUAI = '9999999Z';

    console.log(`[SCRIPT] Migrating Data from ${sourceUAI} to ${targetUAI}...`);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 3. Ensure Target Establishment Exists
        // Based on previous debug, establishments table has: uai, name, address, city, postal_code, type, telephone, admin_email
        // We assume UAI is the unique key (PK likely, or unique constraint).
        const upsertEst = `
            INSERT INTO establishments (uai, name, address, city, postal_code, type, telephone, admin_email, created_at, updated_at)
            VALUES ($1, 'Lycée de Démonstration (Sandbox)', '12 Rue Ampère', 'Elbeuf', '76500', 'LP', '02 35 77 77 77', 'pledgeum@gmail.com', NOW(), NOW())
            ON CONFLICT (uai) DO UPDATE SET 
                name = EXCLUDED.name,
                updated_at = NOW()
            RETURNING uai, name;
        `;
        const estRes = await client.query(upsertEst, [targetUAI]);
        console.log(`[SCRIPT] Target Establishment: ${estRes.rows[0].uai} - ${estRes.rows[0].name}`);

        // 4. Migrate Users
        const userRes = await client.query(`
            UPDATE users 
            SET establishment_uai = $1, updated_at = NOW()
            WHERE establishment_uai = $2
        `, [targetUAI, sourceUAI]);
        console.log(`[SCRIPT] Users Migrated: ${userRes.rowCount}`);

        // 5. Migrate Classes
        const classRes = await client.query(`
            UPDATE classes 
            SET establishment_uai = $1, updated_at = NOW()
            WHERE establishment_uai = $2
        `, [targetUAI, sourceUAI]);
        console.log(`[SCRIPT] Classes Migrated: ${classRes.rowCount}`);

        // 6. Migrate Conventions (if table exists and has column)
        const checkConv = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'conventions' AND column_name = 'establishment_uai'
        `);

        if (checkConv.rowCount > 0) {
            const convRes = await client.query(`
                UPDATE conventions 
                SET establishment_uai = $1, updated_at = NOW()
                WHERE establishment_uai = $2
            `, [targetUAI, sourceUAI]);
            console.log(`[SCRIPT] Conventions Migrated: ${convRes.rowCount}`);
        } else {
            console.warn(`[SCRIPT] 'conventions' table or 'establishment_uai' column not found. Skipping conventions.`);
            // Check for schoolId?
            const checkSchoolId = await client.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'conventions' AND column_name = 'schoolId'
            `);
            if (checkSchoolId.rowCount > 0) {
                // Note: SQL identifiers usually lowercase unless quoted. schema.ts has schoolId (camelCase).
                // DB likely uses snake_case keys or matching if created via ORM.
                // We will check 'school_id' or 'schoolid' if schoolId not found? 
                // Actually information_schema.columns are lowercased usually. 
                // Let's assume checking 'establishment_uai' covers the main usage we saw in api.
                // If not found, we print usage.
            }
        }

        // 7. Remove Ghost Establishment if it exists (Optional, but clean)
        // Only if not same (sanity check)
        if (sourceUAI !== targetUAI) {
            const delEst = await client.query('DELETE FROM establishments WHERE uai = $1', [sourceUAI]);
            console.log(`[SCRIPT] Ghost Establishment ${sourceUAI} Deleted: ${delEst.rowCount}`);
        }

        await client.query('COMMIT');
        console.log('[SCRIPT] Migration Success.');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[SCRIPT] Error:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
