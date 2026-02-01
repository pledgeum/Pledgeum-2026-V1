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

    try {
        console.log("=== STEP 1: All Conventions Audit ===");
        // Adjusted column names based on known schema: student_id -> student_uid, data -> metadata
        const res = await pool.query(`
            SELECT 
                c.id, 
                c.updated_at, 
                c.establishment_uai, 
                c.student_uid, 
                u.first_name, 
                u.last_name, 
                u.email,
                c.status as db_status,
                c.metadata ->> 'status' as json_status
            FROM conventions c
            LEFT JOIN users u ON c.student_uid = u.uid
            ORDER BY c.updated_at DESC;
        `);

        if (res.rows.length === 0) {
            console.log("⚠️ Result: 0 rows found in 'conventions' table.");
        } else {
            console.table(res.rows.map(r => ({
                id: r.id.substring(0, 15) + '...',
                updated: r.updated_at ? new Date(r.updated_at).toISOString().split('T')[0] : 'N/A',
                uai: r.establishment_uai,
                student_uid: r.student_uid ? r.student_uid.substring(0, 10) + '...' : 'NULL',
                user: r.email || 'NULL (Ghost)',
                status: r.db_status
            })));
        }

        console.log("\n=== STEP 3 (Skipped 2): Check User 'Tyméo' UAI ===");
        const userRes = await pool.query(`
            SELECT uid, email, first_name, last_name, establishment_uai 
            FROM users 
            WHERE email ILIKE '%tymeo%' OR last_name ILIKE '%BERTHOU%';
        `);
        console.table(userRes.rows);

    } catch (err) {
        console.error("Error executing audit:", err);
    } finally {
        await pool.end();
    }
}

main();
