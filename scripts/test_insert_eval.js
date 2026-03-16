const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function main() {
    try {
        console.log("=== Test d'insertion ===");
        // On prend une convention existante (conv_yicwjkf6b)
        const sql = `
            INSERT INTO evaluations (convention_id, template_id, evaluator_email, answers, status)
            VALUES ($1, $2, $3, $4::jsonb, $5)
            ON CONFLICT (convention_id, template_id) DO UPDATE SET updated_at = NOW()
            RETURNING id;
        `;
        const res = await pool.query(sql, ['conv_yicwjkf6b', 'test_template', 'test@test.fr', '{}', 'DRAFT']);
        console.log("Insertion réussie, ID:", res.rows[0].id);

        const check = await pool.query('SELECT count(*) FROM evaluations');
        console.log("Nombre de lignes total:", check.rows[0].count);

    } catch (e) {
        console.error("ERREUR d'insertion:", e);
    } finally {
        pool.end();
    }
}

main();
