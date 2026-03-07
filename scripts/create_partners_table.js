const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function createPartnersTable() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL
    });

    try {
        console.log("🚀 Création de la table partners...");

        const query = `
            CREATE TABLE IF NOT EXISTS partners (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                school_id VARCHAR(255) NOT NULL,
                siret VARCHAR(14) UNIQUE,
                name VARCHAR(255) NOT NULL,
                address TEXT,
                city VARCHAR(255),
                postal_code VARCHAR(20),
                latitude DOUBLE PRECISION,
                longitude DOUBLE PRECISION,
                activities JSONB DEFAULT '[]'::jsonb,
                sectors JSONB DEFAULT '[]'::jsonb,
                created_at TIMESTAMP DEFAULT NOW()
            );

            -- Index pour la recherche par école
            CREATE INDEX IF NOT EXISTS idx_partners_school ON partners(school_id);

            -- Index pour accélérer la recherche géographique
            CREATE INDEX IF NOT EXISTS idx_partners_lat_lng ON partners(latitude, longitude);
        `;

        await pool.query(query);
        console.log("✅ Table partners créée avec succès !");

    } catch (err) {
        console.error("❌ Erreur lors de la création de la table :", err);
    } finally {
        await pool.end();
    }
}

createPartnersTable();
