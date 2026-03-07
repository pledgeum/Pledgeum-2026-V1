require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function updatePartnersTable() {
    try {
        console.log("🚀 Ajout de la colonne 'classes' à la table partners...");

        // Add column if not exists
        await pool.query(`
        ALTER TABLE partners 
        ADD COLUMN IF NOT EXISTS classes JSONB DEFAULT '[]'::jsonb;
    `);

        console.log("✅ Colonne 'classes' ajoutée (ou déjà existante).");

        // Let's verify the columns
        const res = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'partners';
    `);
        console.log("Colonnes actuelles de la table partners :");
        res.rows.forEach(r => console.log(`- ${r.column_name} (${r.data_type})`));

    } catch (e) {
        console.error("Erreur lors de la mise à jour :", e);
    } finally {
        await pool.end();
    }
}

updatePartnersTable();
