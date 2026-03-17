
import pool from '@/lib/pg';

async function migrate() {
    console.log('Running migration: Create school_convention_settings table...');
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS school_convention_settings (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                school_uai VARCHAR(10) NOT NULL,
                convention_type_id VARCHAR(50) NOT NULL,
                class_ids JSONB DEFAULT '[]'::jsonb,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            -- Index for faster lookups by school
            CREATE INDEX IF NOT EXISTS idx_school_convention_settings_uai ON school_convention_settings(school_uai);
            
            -- Unique constraint to prevent duplicate settings for the same school and convention type
            CREATE UNIQUE INDEX IF NOT EXISTS idx_school_uai_convention_type_unique ON school_convention_settings(school_uai, convention_type_id);
        `);
        console.log('Migration successful: school_convention_settings table ensured.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        client.release();
        // Force close pool to exit script
        await pool.end();
    }
}

migrate();
    
