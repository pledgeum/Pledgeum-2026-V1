require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function run() {
    const client = await pool.connect();
    try {
        const query = `
        CREATE TABLE IF NOT EXISTS absences (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            convention_id VARCHAR(255) NOT NULL REFERENCES conventions(id) ON DELETE CASCADE,
            type VARCHAR(50) NOT NULL CHECK (type IN ('absence', 'retard')),
            date DATE NOT NULL,
            duration NUMERIC NOT NULL,
            reason TEXT,
            reported_by VARCHAR(255) NOT NULL,
            reported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_absences_convention_id ON absences(convention_id);
    `;
        await client.query(query);
        console.log("Table 'absences' created successfully with index on convention_id.");
    } catch (err) {
        console.error(err);
    } finally {
        client.release();
        pool.end();
    }
}

run();
