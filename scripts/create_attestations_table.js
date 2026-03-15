const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load .env.local
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        await client.connect();
        console.log("✅ Connecté à PostgreSQL.");

        const sql = `
            CREATE TABLE IF NOT EXISTS attestations (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                convention_id VARCHAR(255) NOT NULL REFERENCES conventions(id) ON DELETE CASCADE,
                total_days_present INT DEFAULT 0,
                absences_hours INT DEFAULT 0,
                activities TEXT,
                skills_evaluation TEXT,
                gratification_amount TEXT DEFAULT '0',
                signer_name TEXT,
                signer_function TEXT,
                signature_date TIMESTAMP,
                signature_img TEXT,
                signature_code TEXT,
                pdf_hash TEXT,
                audit_logs JSONB DEFAULT '[]'::jsonb,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(convention_id)
            );

            -- Create index for faster lookups
            CREATE INDEX IF NOT EXISTS idx_attestations_convention_id ON attestations(convention_id);

            -- Trigger for updated_at
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql';

            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_attestations_updated_at') THEN
                    CREATE TRIGGER update_attestations_updated_at
                    BEFORE UPDATE ON attestations
                    FOR EACH ROW
                    EXECUTE FUNCTION update_updated_at_column();
                END IF;
            END $$;
        `;

        console.log("🏗️  Création de la table attestations...");
        await client.query(sql);
        console.log("✅ Table attestations créée avec succès.");

    } catch (err) {
        console.error("❌ Erreur lors de la création de la table :", err);
    } finally {
        await client.end();
        console.log("🔌 Déconnecté.");
    }
}

main();
