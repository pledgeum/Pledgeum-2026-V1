const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgres://Pledgeum_admin:Fa2BVCcYmysEiyx!!!@51.159.113.59:26093/rdb'
});

async function run() {
    try {
        const beginRes = await pool.query('BEGIN');

        // Requête de création de table des gabarits d'évaluation
        const createQuery = `
        CREATE TABLE IF NOT EXISTS evaluation_templates (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            author_id VARCHAR(255) NOT NULL,
            title VARCHAR(255) NOT NULL,
            subtitle TEXT,
            structure JSONB NOT NULL DEFAULT '{}'::jsonb,
            assigned_class_ids TEXT[] DEFAULT '{}',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_eval_templates_author ON evaluation_templates(author_id);
    `;

        console.log("Exécution de la création de la table evaluation_templates...");
        await pool.query(createQuery);
        await pool.query('COMMIT');
        console.log(`✅ Opération réussie. Table evaluation_templates créée avec clé UUID et tableau de classes (TEXT[]).`);
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Erreur SQL lors de la création de table :', error);
    } finally {
        pool.end();
    }
}

run();
