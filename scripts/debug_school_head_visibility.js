
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function debugVisibility() {
    try {
        console.log("=== DEBUGGING SCHOOL HEAD VISIBILITY ===");

        // 1. Check School Heads
        const { rows: heads } = await pool.query(`
      SELECT uid, email, role, establishment_uai 
      FROM users 
      WHERE role = 'school_head'
    `);

        console.log("\n--- School Heads in Users Table ---");
        console.table(heads);

        for (const head of heads) {
            console.log(`\nChecking associations for: ${head.email}`);

            // 2. Check Establishment by admin_email fallback
            const { rows: estByEmail } = await pool.query(`
        SELECT uai, name, admin_email 
        FROM establishments 
        WHERE admin_email = $1
      `, [head.email]);

            console.log(`Establishments linked by admin_email:`);
            console.table(estByEmail);

            // 3. Check Establishment by establishment_uai
            if (head.establishment_uai) {
                const { rows: estByUai } = await pool.query(`
          SELECT uai, name, admin_email 
          FROM establishments 
          WHERE uai = $1
        `, [head.establishment_uai]);
                console.log(`Establishments linked by establishment_uai (${head.establishment_uai}):`);
                console.table(estByUai);
            } else {
                console.log("No establishment_uai set on user record.");
            }

            // 4. Count conventions for this head's UAI(s)
            const uais = new Set([
                head.establishment_uai,
                ...estByEmail.map(e => e.uai)
            ].filter(Boolean));

            for (const uai of uais) {
                const { rows: convCount } = await pool.query(`
          SELECT status, count(*) 
          FROM conventions 
          WHERE establishment_uai = $1
          GROUP BY status
        `, [uai]);
                console.log(`\nConvention counts for UAI ${uai}:`);
                console.table(convCount);
            }
        }

    } catch (err) {
        console.error("Debug Error:", err);
    } finally {
        await pool.end();
    }
}

debugVisibility();
