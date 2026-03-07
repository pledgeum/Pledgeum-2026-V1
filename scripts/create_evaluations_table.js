const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgres://Pledgeum_admin:Fa2BVCcYmysEiyx!!!@51.159.113.59:26093/rdb'
});

async function run() {
    try {
        const beginRes = await pool.query('BEGIN');

        // Requête de création de table
        const createQuery = `
      CREATE TABLE IF NOT EXISTS evaluations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          convention_id VARCHAR(255) NOT NULL REFERENCES conventions(id) ON DELETE CASCADE,
          template_id VARCHAR(255) NOT NULL,
          evaluator_email VARCHAR(255) NOT NULL,
          answers JSONB NOT NULL DEFAULT '{}'::jsonb,
          synthesis TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(convention_id, template_id)
      );

      CREATE INDEX IF NOT EXISTS idx_evaluations_convention ON evaluations(convention_id);
    `;

        console.log("Exécution de la création de la table assessments (evaluations)...");
        await pool.query(createQuery);
        await pool.query('COMMIT');
        console.log(`✅ Opération réussie. Table évaluations créée.`);
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Erreur SQL lors de la création de table :', error);
    } finally {
        pool.end();
    }
}

run();
