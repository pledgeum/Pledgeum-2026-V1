
const { Pool } = require('pg');

// Using credentials from .env.local
const pool = new Pool({
    user: 'Pledgeum_admin',
    host: '51.159.113.59',
    database: 'rdb',
    password: 'Fa2BVCcYmysEiyx!!!',
    port: 26093,
    ssl: { rejectUnauthorized: false }
});

async function findGhostMappings() {
    const client = await pool.connect();
    try {
        console.log("🔍 Searching for Ghost Teachers linked to Classes...");

        // 1. Find all classes with ghost teachers (email contains '.temp' or 'pledgeum')
        // Adjust filter based on observed ghost format: 'teacher-176...@pledgeum.temp'
        const ghostQuery = `
            SELECT 
                c.id as class_id, 
                c.name as class_name, 
                u.uid as ghost_id, 
                u.first_name, 
                u.last_name, 
                u.email as ghost_email,
                u.establishment_uai
            FROM classes c
            JOIN users u ON c.main_teacher_id = u.uid
            WHERE u.email LIKE '%@pledgeum.temp' OR u.email LIKE '%@pledgeum.te'
        `;

        const ghosts = await client.query(ghostQuery);
        if (ghosts.rows.length === 0) {
            console.log("✅ No classes linked to ghost accounts found.");
            return;
        }

        console.log(`⚠️  Found ${ghosts.rows.length} classes linked to ghost accounts.`);

        // 2. For each ghost, try to find a "Real" user with same First/Last name AND same Establishment
        for (const ghost of ghosts.rows) {
            console.log(`\n👻 Ghost: ${ghost.first_name} ${ghost.last_name} (${ghost.class_name}) - ${ghost.ghost_email}`);

            const realQuery = `
                SELECT uid, email, first_name, last_name
                FROM users 
                WHERE LOWER(first_name) = LOWER($1) 
                  AND LOWER(last_name) = LOWER($2)
                  AND establishment_uai = $3
                  AND email NOT LIKE '%@pledgeum.temp'
                  AND email NOT LIKE '%@pledgeum.te'
            `;

            const realCandidates = await client.query(realQuery, [ghost.first_name, ghost.last_name, ghost.establishment_uai]);

            if (realCandidates.rows.length > 0) {
                const real = realCandidates.rows[0];
                console.log(`   ✅ MATCH FOUND: ${real.first_name} ${real.last_name} (${real.email})`);
                console.log(`   👉 SUGGESTED ACTION: UPDATE classes SET main_teacher_id = '${real.uid}' WHERE id = '${ghost.class_id}';`);
                console.log(`   👉 ALTERNATIVE: DELETE ghost user '${ghost.ghost_id}' after remapping.`);
            } else {
                console.log(`   ❌ NO MATCH FOUND. Manual intervention required.`);
            }
        }

    } catch (err) {
        console.error("Error executing query:", err);
    } finally {
        client.release();
        pool.end();
    }
}

findGhostMappings();
