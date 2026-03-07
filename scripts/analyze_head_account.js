
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function analyzeAccount() {
    const email = 'fabrice.dumasdelage@gmail.com';
    try {
        console.log(`=== ANALYZING ACCOUNT: ${email} ===`);

        // 1. User Record
        const { rows: users } = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        console.log("\n--- User Record ---");
        if (users.length === 0) {
            console.log("No user found with this email.");
            return;
        }
        console.table(users.map(u => ({ uid: u.uid, role: u.role, uai: u.establishment_uai, email: u.email })));

        const uai = users[0].establishment_uai;

        // 2. Establishment Record
        console.log("\n--- Establishment Records (by UAI or Admin Email) ---");
        const { rows: ests } = await pool.query("SELECT uai, name, admin_email FROM establishments WHERE uai = $1 OR admin_email = $2", [uai, email]);
        console.table(ests);

        // 3. Conventions for this UAI
        if (uai) {
            console.log(`\n--- Conventions for UAI: ${uai} ---`);
            const { rows: convs } = await pool.query("SELECT status, count(*) FROM conventions WHERE establishment_uai = $1 GROUP BY status", [uai]);
            console.table(convs);

            const { rows: sampleConvs } = await pool.query("SELECT id, status, establishment_uai FROM conventions WHERE establishment_uai = $1 LIMIT 3", [uai]);
            console.log("Sample Conventions:");
            console.table(sampleConvs);
        }

        // 4. Check for case sensitivity or invisible chars in UAI
        if (uai) {
            console.log(`\nUAI Details: "${uai}" (Length: ${uai.length})`);
            const { rows: exactMatch } = await pool.query("SELECT count(*) FROM conventions WHERE establishment_uai = $1", [uai]);
            console.log(`Conventions matching exactly "${uai}": ${exactMatch[0].count}`);
        }

    } catch (err) {
        console.error("Analysis Error:", err);
    } finally {
        await pool.end();
    }
}

analyzeAccount();
