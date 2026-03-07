const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function fixEstablishmentAdmin() {
    const email = 'fabrice.dumasdelage@gmail.com';
    const uai = '9999999Z';

    try {
        console.log(`Setting admin_email for establishment ${uai} to ${email}...`);

        const res = await pool.query(
            "UPDATE establishments SET admin_email = $1 WHERE uai = $2 RETURNING *",
            [email, uai]
        );

        if (res.rowCount === 0) {
            console.error(`❌ Establishment ${uai} NOT FOUND.`);
        } else {
            console.log("✅ Establishment updated successfully:", res.rows[0]);
        }

        // Also ensure Fabrice's role is school_head in users table (just in case)
        const userRes = await pool.query(
            "UPDATE users SET role = 'school_head', establishment_uai = $1 WHERE email = $2 RETURNING uid, email, role, establishment_uai",
            [uai, email]
        );
        console.log("✅ User record updated/verified:", userRes.rows[0]);

    } catch (err) {
        console.error("❌ Error during fix:", err);
    } finally {
        await pool.end();
    }
}

fixEstablishmentAdmin();
