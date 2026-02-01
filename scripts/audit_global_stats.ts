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
        console.log('--- DATABASE AUDIT: GLOBAL STATS ---');

        // 1. Fetch all Establishments
        // Schema Inspection showed NO 'id', so we use 'uai' as the primary key/identifier.
        const estRes = await client.query('SELECT uai, name FROM establishments ORDER BY name ASC');
        const establishments = estRes.rows;

        const stats: any[] = [];

        // 2. Aggregate Counts for each Establishment
        for (const est of establishments) {
            const uai = est.uai;

            const studentCountRes = await client.query(
                `SELECT COUNT(*) FROM users WHERE role = 'student' AND establishment_uai = $1`,
                [uai]
            );

            const teacherCountRes = await client.query(
                `SELECT COUNT(*) FROM users WHERE (role = 'teacher' OR role = 'main_teacher') AND establishment_uai = $1`,
                [uai]
            );

            // Check Classes
            let classCount = 'N/A';
            try {
                // Assuming classes table has establishment_uai
                const classCountRes = await client.query(
                    `SELECT COUNT(*) FROM classes WHERE establishment_uai = $1`,
                    [uai]
                );
                classCount = classCountRes.rows[0].count;
            } catch (e) {
                // Ignore if column missing
            }

            stats.push({
                UAI: uai || 'MISSING', // e.g. if uai matches but is null? (Not possible if used in WHERE)
                Name: est.name,
                Students: studentCountRes.rows[0].count,
                Teachers: teacherCountRes.rows[0].count,
                Classes: classCount
            });
        }

        // 3. Detect Orphans
        const orphanRes = await client.query(`
        SELECT COUNT(*) as count 
        FROM users 
        WHERE establishment_uai IS NOT NULL 
        AND establishment_uai NOT IN (SELECT uai FROM establishments WHERE uai IS NOT NULL)
    `);

        // 4. Ghost UAI Check
        const ghostRes = await client.query(`
        SELECT COUNT(*) as count FROM users WHERE establishment_uai = '9999999X'
    `);

        // Display Table
        console.table(stats);

        console.log('\n--- ORPHAN DATA CHECK ---');
        console.log('Orphan Users (UAI not in Establishments):', orphanRes.rows[0].count);
        console.log('Users linked to Ghost UAI (9999999X):', ghostRes.rows[0].count);

    } catch (err) {
        console.error('[FATAL AUDIT ERROR]', err);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
