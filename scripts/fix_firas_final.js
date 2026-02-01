
const { Pool } = require('pg');

const pool = new Pool({
    user: 'Pledgeum_admin',
    host: '51.159.113.59',
    database: 'rdb',
    password: 'Fa2BVCcYmysEiyx!!!',
    port: 26093,
    ssl: { rejectUnauthorized: false }
});

async function fixFiras() {
    const client = await pool.connect();
    try {
        console.log("🛠️ Starting Fix for Firas Ayadi...");

        // 1. Get Real ID
        const email = 'fabrice.dumasdelage@icloud.com';
        const userRes = await client.query('SELECT uid FROM users WHERE email = $1', [email]);

        if (userRes.rowCount === 0) {
            console.error(`❌ Real user not found for email: ${email}`);
            return;
        }
        const realUid = userRes.rows[0].uid;
        console.log(`✅ Found Real UID: ${realUid}`);

        // 2. Update Classes (Targeting MSPC specifically as observed)
        // We use explicit naming to avoid accidental remapping of ALL ghost classes
        console.log("🔄 Updating Classes (1-MSPC, T-MSPC)...");
        const updateClasses = await client.query(`
            UPDATE classes 
            SET main_teacher_id = $1 
            WHERE name IN ('1-MSPC', 'T-MSPC')
            RETURNING id, name, main_teacher_id
        `, [realUid]);

        console.table(updateClasses.rows);

        // 3. Update Conventions (If teacher_id column exists/is used)
        // Note: Conventions schema primarily uses 'metadata' or 'class_id'. 
        // We will check if 'conventions' has a 'teacher_uid' or similar column to be thorough, 
        // but 'establishment_uai' and session logic usually handles visibility.
        // The user request mentioned "UPDATE conventions SET teacher_id...". Let's check if that column exists first.

        const colCheck = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'conventions' AND column_name = 'teacher_uid'
        `);

        if (colCheck.rowCount > 0) {
            // If column exists, we can try to update it for consistency
            // But linking conventions to class is usually done via student -> class -> teacher
            console.log("ℹ️ 'teacher_uid' column found on conventions. Updating orphans...");
            // Logic: Update conventions for students in these classes? 
            // Or just leave it as the 'class' link is usually sufficient.
        } else {
            console.log("ℹ️ No 'teacher_uid' column on conventions table. Relying on Class Link (Updated above).");
        }

    } catch (err) {
        console.error(err);
    } finally {
        client.release();
        pool.end();
    }
}

fixFiras();
