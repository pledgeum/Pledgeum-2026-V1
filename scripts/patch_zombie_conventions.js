
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function patch() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL
    });

    try {
        console.log("🔍 Recherche des conventions 'zombie'...");

        const res = await pool.query(`
            UPDATE conventions
            SET status = 'VALIDATED_HEAD', updated_at = NOW()
            WHERE metadata->'signatures'->'head' IS NOT NULL 
            AND status NOT IN ('VALIDATED_HEAD', 'COMPLETED', 'CANCELED')
            RETURNING id, status;
        `);

        if (res.rowCount > 0) {
            console.log(`✅ Succès ! ${res.rowCount} conventions ont été réparées.`);
            res.rows.forEach(row => {
                console.log(`   - Convention ${row.id} -> ${row.status}`);
            });
        } else {
            console.log("ℹ️ Aucune convention à réparer trouvée.");

            // Debug : Vérifier si le chemin JSONB est correct
            const check = await pool.query(`
                SELECT id, status, metadata->'signatures'->'head' as head_sig
                FROM conventions 
                LIMIT 5
            `);
            console.log("Exemple de données pour vérification :");
            console.table(check.rows);
        }

    } catch (err) {
        console.error("❌ Erreur pendant le patch :", err);
    } finally {
        await pool.end();
    }
}

patch();
