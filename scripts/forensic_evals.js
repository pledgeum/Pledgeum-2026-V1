const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function main() {
    try {
        console.log("=== Audit des évaluations ===");
        const res = await pool.query('SELECT * FROM evaluations ORDER BY updated_at DESC LIMIT 5');
        
        if (res.rows.length === 0) {
            console.log("Aucune évaluation trouvée.");
        }

        res.rows.forEach(row => {
            console.log(`\n--- Évaluation: ${row.convention_id} (Template: ${row.template_id}) ---`);
            console.log(`Status: ${row.status}`);
            console.log(`Evaluator: ${row.evaluator_email}`);
            console.log(`Answers (keys): ${Object.keys(row.answers || {}).join(', ')}`);
            console.log(`Tutor Answers (keys): ${Object.keys(row.tutor_answers || {}).join(', ')}`);
            console.log(`Sample Answer:`, row.answers ? Object.values(row.answers)[0] : 'N/A');
        });

    } catch (e) {
        console.error("Erreur", e);
    } finally {
        pool.end();
    }
}

main();
