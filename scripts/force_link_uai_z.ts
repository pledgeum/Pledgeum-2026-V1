
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

    // 2. Dynamic Import of Pool (after env is set)
    // @ts-ignore
    const { default: pool } = await import('../src/lib/pg');


    const targetEmail = 'fabrice.dumasdelage@gmail.com';
    const targetUAI = '9999999Z';

    console.log(`[SCRIPT] Force Linking ${targetEmail} to ${targetUAI}...`);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // DEBUG: Check columns
        const cols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'establishments'");
        console.log('[DEBUG] Establishments Columns:', cols.rows.map(r => r.column_name));

        const userCols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'");
        console.log('[DEBUG] Users Columns:', userCols.rows.map(r => r.column_name));

        // 3. Get Establishment ID (if exists) or just check UAI
        // Check if 'id' exists in the columns we just fetched
        const hasId = cols.rows.some(r => r.column_name === 'id');
        const hasUuid = cols.rows.some(r => r.column_name === 'uuid');

        let establishmentId: string | null = null;
        if (hasId) {
            const estRes = await client.query('SELECT id FROM establishments WHERE uai = $1', [targetUAI]);
            if ((estRes.rowCount || 0) > 0) establishmentId = estRes.rows[0].id;
        } else if (hasUuid) {
            const estRes = await client.query('SELECT uuid FROM establishments WHERE uai = $1', [targetUAI]);
            if ((estRes.rowCount || 0) > 0) establishmentId = estRes.rows[0].uuid;
        } else {
            console.log("No UUID/ID column found on establishments. Assuming UAI is FK.");
        }

        // 4. Update User
        // Check if users has establishment_id
        const userHasEstId = userCols.rows.some(r => r.column_name === 'establishment_id');

        let updateQuery = `
            UPDATE users 
            SET 
                role = 'ESTABLISHMENT_ADMIN',
                establishment_uai = $1,
                updated_at = NOW()
        `;
        const params = [targetUAI, targetEmail];

        if (userHasEstId && establishmentId) {
            updateQuery = `
                UPDATE users 
                SET 
                    role = 'ESTABLISHMENT_ADMIN',
                    establishment_uai = $1,
                    establishment_id = $3,
                    updated_at = NOW()
            `;
            params.push(establishmentId); // $3
        }

        updateQuery += ` WHERE email = $2 RETURNING uid, role, establishment_uai`;
        if (userHasEstId) updateQuery += `, establishment_id`;

        // Adjust param index in WHERE clause if needed
        if (userHasEstId && establishmentId) {
            // Params: [uai, email, uuid] -> $1, $3, $2 (email is $2)
            // Wait, params order: [targetUAI, targetEmail, establishmentId]
            // Query uses $1, $2, $3.
            // establishment_id = $3. 
            // WHERE email = $2.
            // Yes.
            console.log("Updating with establishment_id...");
        } else {
            console.log("Updating WITHOUT establishment_id (column missing or ID not found)...");
        }

        const updateRes = await client.query(updateQuery, params);

        if (updateRes.rowCount === 0) {
            throw new Error(`User ${targetEmail} not found!`);
        }

        console.log('[SCRIPT] User Updated:', updateRes.rows[0]);

        await client.query('COMMIT');
        console.log('[SCRIPT] Success.');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[SCRIPT] Error:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
