const { Pool } = require('pg');
const pool = new Pool({
    user: 'Pledgeum_admin',
    host: '51.159.113.59',
    database: 'rdb',
    password: 'Fa2BVCcYmysEiyx!!!',
    port: 26093,
    ssl: { rejectUnauthorized: false }
});

async function resetFirasSignup() {
    const client = await pool.connect();
    try {
        console.log("🔍 Searching for Firas AYADI accounts...");

        // 1. Find all potential matches
        const res = await client.query(`
            SELECT 
                u.uid, u.email, u.first_name, u.last_name, u.role, u.temp_code, u.temp_id,
                (SELECT COUNT(*) FROM classes c WHERE c.main_teacher_id = u.uid) as class_count
            FROM users u
            WHERE (u.first_name ILIKE '%Firas%' OR u.last_name ILIKE '%Firas%')
               OR (u.first_name ILIKE '%Ayadi%' OR u.last_name ILIKE '%Ayadi%')
        `);

        if (res.rows.length === 0) {
            console.log("❌ No users found matching 'Firas' or 'Ayadi'.");
            return;
        }

        console.log(`🔎 Found ${res.rows.length} users:`);

        let ghostAccount = null;
        let duplicateAccount = null;

        res.rows.forEach(user => {
            console.log(`   - [${user.uid}] ${user.first_name} ${user.last_name} (${user.email})`);
            console.log(`     Role: ${user.role}, Classes: ${user.class_count}, TempCode: ${user.temp_code || 'NULL'}`);

            // Ghost has classes or temp data
            if (parseInt(user.class_count) > 0 || user.email.startsWith('teacher-')) {
                ghostAccount = user;
            }
            // Duplicate has no classes and real email
            else if (!user.email.startsWith('teacher-') && parseInt(user.class_count) === 0) {
                duplicateAccount = user;
            }
        });

        // 2. Action Logic
        if (ghostAccount && duplicateAccount) {
            console.log("\n✅ Identification Successful:");
            console.log(`   👻 Ghost Account (To Keep): ${ghostAccount.uid} (${ghostAccount.email})`);
            console.log(`   🗑️ Duplicate Account (To Delete): ${duplicateAccount.uid} (${duplicateAccount.email})`);

            // 3. Delete Duplicate
            console.log("\n🚀 Deleting duplicate account...");
            await client.query('DELETE FROM users WHERE uid = $1', [duplicateAccount.uid]);
            console.log("   ✅ Duplicate account deleted.");

            // 4. Output Credentials
            console.log("\n🎉 READY FOR SIGNUP TEST");
            console.log("==================================================");
            console.log(`👤 User: ${ghostAccount.first_name} ${ghostAccount.last_name}`);
            console.log(`🔑 Temporary ID (Code on Sheet?): ${ghostAccount.temp_id || 'N/A'}`);
            console.log(`🔢 Temporary Code (for Signup): ${ghostAccount.temp_code}`);
            console.log(`📧 Temporary Email (Internal): ${ghostAccount.email}`);
            console.log("==================================================");

        } else if (ghostAccount && !duplicateAccount) {
            console.log("\n⚠️ Only Ghost Account found. Duplicate may already be deleted.");
            console.log(`🔑 Temp Code: ${ghostAccount.temp_code}`);
        } else if (!ghostAccount && duplicateAccount) {
            console.log("\n❌ CRITICAL: Found duplicate but NO Ghost account with data! Aborting delete to prevent data loss.");
        } else {
            console.log("\n❌ Could not clearly identify Ghost vs Duplicate pair.");
        }

    } catch (err) {
        console.error("Error executing reset:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

resetFirasSignup();
