import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function main() {
    const client = await pool.connect();
    try {
        console.log('--- DEBUG VISIBLE CLASSES & COUNTS ---');
        const uai = '9999999Z';

        const res = await client.query(`
        SELECT 
            c.id, 
            c.name, 
            (SELECT COUNT(*) FROM users u WHERE u.class_id = c.id) as real_count,
            c.establishment_uai
        FROM classes c
        WHERE c.establishment_uai = $1
        ORDER BY c.name
    `, [uai]);

        console.log(`Found ${res.rowCount} classes for UAI ${uai}:`);
        console.log('---------------------------------------------------');
        console.log('Name'.padEnd(20) + ' | ' + 'ID'.padEnd(40) + ' | ' + 'Count');
        console.log('---------------------------------------------------');

        res.rows.forEach(r => {
            console.log(`${r.name.padEnd(20)} | ${r.id.padEnd(40)} | ${r.real_count}`);
        });
        console.log('---------------------------------------------------');

        // Also check total students for this UAI to ensure none are orphaned
        const totalRes = await client.query(`SELECT COUNT(*) FROM users WHERE establishment_uai = $1 AND role = 'student'`, [uai]);
        console.log(`Total Students in UAI ${uai}: ${totalRes.rows[0].count}`);

        // Check count of students with NULL class_id
        const nullClassRes = await client.query(`SELECT COUNT(*) FROM users WHERE establishment_uai = $1 AND role = 'student' AND class_id IS NULL`, [uai]);
        console.log(`Students with NULL class_id: ${nullClassRes.rows[0].count}`);

    } catch (err) {
        console.error(err);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
