const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://Pledgeum_admin:Fa2BVCcYmysEiyx!!!@51.159.113.59:26093/rdb',
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log("Mise à jour de la table evaluations...");
        
        // Ajout des colonnes pour le workflow et la signature
        await client.query(`
            ALTER TABLE evaluations 
            ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'DRAFT',
            ADD COLUMN IF NOT EXISTS final_grade VARCHAR(50),
            ADD COLUMN IF NOT EXISTS teacher_signed_at TIMESTAMP WITH TIME ZONE,
            ADD COLUMN IF NOT EXISTS teacher_signature_img TEXT,
            ADD COLUMN IF NOT EXISTS teacher_signature_hash TEXT,
            ADD COLUMN IF NOT EXISTS teacher_signature_ip TEXT;
        `);

        // S'assurer que convention_id dans evaluations référence correctement conventions
        // (Déjà fait dans create_evaluations_table.js mais au cas où)
        
        await client.query('COMMIT');
        console.log("✅ Migration réussie.");
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("❌ Erreur de migration:", e);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
