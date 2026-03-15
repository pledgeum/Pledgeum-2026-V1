
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function migrate() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL
    });

    try {
        console.log("🚀 Lancement de la migration : Ajout de la colonne pfmp_periods à la table classes...");
        
        await pool.query(`
            ALTER TABLE classes 
            ADD COLUMN IF NOT EXISTS pfmp_periods JSONB DEFAULT '[]';
        `);

        console.log("✅ Migration terminée avec succès !");
    } catch (err) {
        console.error("❌ Erreur pendant la migration :", err);
    } finally {
        await pool.end();
    }
}

migrate();
