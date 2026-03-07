import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import pool from './src/lib/pg';

async function testInsert() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const conventionsId = 'conv_test123';
        const query = `
            INSERT INTO conventions (
                id, 
                student_uid, 
                status, 
                created_at, 
                updated_at,
                metadata,
                date_start,
                date_end
            ) VALUES ($1, $2, $3, NOW(), NOW(), $4, $5, $6)
            RETURNING *
        `;
        const result = await client.query(query, [
            conventionsId,
            'test_student_uid',
            'DRAFT',
            JSON.stringify({ ent_siret: '21760540100017' }),
            '2026-04-01',
            '2026-04-30'
        ]);
        console.log("INSERT Result:");
        console.log(result.rows[0]);
        await client.query('ROLLBACK'); // rollback so we don't pollute DB
        console.log("Rolled back successfully");
    } catch (err: any) {
        console.error('Error during INSERT:', err.message);
        await client.query('ROLLBACK');
    } finally {
        client.release();
        await pool.end();
    }
}
testInsert();
