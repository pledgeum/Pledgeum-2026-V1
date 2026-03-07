require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function run() {
    const client = await pool.connect();
    try {
        const query = `
        CREATE TABLE IF NOT EXISTS visits (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            convention_id VARCHAR(255) NOT NULL REFERENCES conventions(id) ON DELETE CASCADE,
            tracking_teacher_email VARCHAR(255) NOT NULL,
            scheduled_date TIMESTAMP WITH TIME ZONE, -- Prévisionnel
            status VARCHAR(50) DEFAULT 'ASSIGNED', -- ASSIGNED, PLANNED, COMPLETED
            report TEXT, -- Pour le futur compte-rendu
            distance_km NUMERIC, -- Pour stocker la distance calculée lors de l'assignation
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(convention_id) -- Une seule visite active par convention pour le moment
        );
        CREATE INDEX IF NOT EXISTS idx_visits_convention_id ON visits(convention_id);
    `;
        await client.query(query);
        console.log("Table 'visits' created successfully.");
    } catch (err) {
        console.error(err);
    } finally {
        client.release();
        pool.end();
    }
}

run();
