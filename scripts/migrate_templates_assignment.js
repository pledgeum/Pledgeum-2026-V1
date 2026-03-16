const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://Pledgeum_admin:Fa2BVCcYmysEiyx!!!@51.159.113.59:26093/rdb',
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`
            ALTER TABLE evaluation_templates 
            ADD COLUMN IF NOT EXISTS assigned_class_ids TEXT[] DEFAULT '{}';
        `);
        await client.query('COMMIT');
        console.log("✅ Migration assigned_class_ids réussie.");
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("❌ Erreur de migration:", e);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
