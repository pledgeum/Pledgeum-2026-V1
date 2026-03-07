const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function main() {
    try {
        const queryCheck = `
            SELECT uid, email, role, establishment_uai 
            FROM users 
            WHERE role = 'student' 
            LIMIT 5;
        `;
        const resCheck = await pool.query(queryCheck);
        console.log("Échantillon d'élèves en BDD :");
        if (resCheck.rowCount === 0) {
            console.log("Aucun élève trouvé avec le rôle 'student'. Ont-ils un autre rôle ?");
        } else {
            resCheck.rows.forEach(r => {
                console.log(`- UID: ${r.uid} | Email: ${r.email} | Role: ${r.role} | UAI: ${r.establishment_uai}`);
            });
        }
    } catch (e) {
        console.error("Error", e);
    } finally {
        pool.end();
    }
}

main();
