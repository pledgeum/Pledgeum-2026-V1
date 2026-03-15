import pool from '../src/lib/pg.js';

async function migrate() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS mission_orders (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                convention_id UUID NOT NULL REFERENCES conventions(id) ON DELETE CASCADE,
                teacher_email VARCHAR(255) NOT NULL,
                student_id VARCHAR(255),
                school_address TEXT,
                company_address TEXT,
                distance_km NUMERIC(5,2),
                status VARCHAR(50) DEFAULT 'PENDING',
                signature_data JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_mission_order_convention ON mission_orders(convention_id);
        `);
        console.log("Migration des Ordres de Mission réussie !");
    } catch (e) {
        console.error("Erreur", e);
    } finally {
        process.exit();
    }
}
migrate();
