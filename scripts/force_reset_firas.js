const { Pool } = require('pg');
const pool = new Pool({
    user: 'Pledgeum_admin',
    host: '51.159.113.59',
    database: 'rdb',
    password: 'Fa2BVCcYmysEiyx!!!',
    port: 26093,
    ssl: { rejectUnauthorized: false }
});

async function reset() {
    const client = await pool.connect();
    try {
        const uid = 'teacher-37036e13-0a8b-4e71-98cf-94e522d3b1f2';
        console.log(`🔄 Resetting account ${uid} to Ghost Status...`);

        // Update email to temp and set code
        const res = await client.query(`
            UPDATE users 
            SET email = 'teacher-firas-reset@pledgeum.fr',
                temp_code = 'FIRAS2026',
                temp_id = 'T-FIRAS-RESET', 
                email_verified = NULL,
                password_hash = NULL
            WHERE uid = $1
            RETURNING *
        `, [uid]);

        if (res.rowCount > 0) {
            console.log("✅ Account Reset Successful:");
            const u = res.rows[0];
            console.log(`   - Name: ${u.first_name} ${u.last_name}`);
            console.log(`   - Email (Reset): ${u.email}`);
            console.log(`   - Temp Code: ${u.temp_code}`);
            console.log(`   - Classes Linked: (Preserved)`);
        } else {
            console.log("❌ Failed to update account. UID not found?");
        }

    } catch (err) {
        console.error(err);
    } finally {
        client.release();
        await pool.end();
    }
}

reset();
