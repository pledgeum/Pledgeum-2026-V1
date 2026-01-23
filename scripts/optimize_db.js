
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const config = {
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    ssl: { rejectUnauthorized: false }
};

const pool = new Pool(config);

async function optimize() {
    const client = await pool.connect();
    try {
        console.log("--- STARTING OPTIMIZATION ---");

        // 1. TIMESTAMPS
        const tables = ['establishments', 'classes', 'users', 'conventions'];
        for (const table of tables) {
            console.log(`Checking timestamps for ${table}...`);
            await client.query(`
                ALTER TABLE ${table}
                ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
                ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
            `);
        }
        console.log("✅ Timestamps verified/added.");

        // 2. INDEXES
        console.log("Creating/Verifying Indexes...");

        // classes.main_teacher_id
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_classes_main_teacher ON classes(main_teacher_id);
        `);
        // users.establishment_uai
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_users_establishment_uai ON users(establishment_uai);
        `);
        // classes.establishment_uai (Good practice)
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_classes_establishment_uai ON classes(establishment_uai);
        `);

        console.log("✅ Indexes created.");

        // 3. CLASS ID STRATEGY (Commentary)
        // We cannot easily change the PK of an existing table with data without migration logic.
        // User requested: "Utilise un UUID ou un identifiant généré aléatoirement".
        // Current PK is 'id'. We can't change data in place safely here.
        // But we can verify if 'id' column allows arbitrary strings (it is varchar 50).
        // It does. So we just need to change the *generation* logic in the API/Store.

        console.log("--- OPTIMIZATION COMPLETE ---");

    } catch (err) {
        console.error("Optimization Failed:", err);
    } finally {
        client.release();
        pool.end();
    }
}

optimize();
