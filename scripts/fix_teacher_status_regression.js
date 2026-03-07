/**
 * Script de nettoyage SQL permettant de rétablir le statut 'VALIDATED_TEACHER'
 * pour toutes les conventions victimes de la régression de statut due 
 * à une signature de l'élève/parent postérieure à celle de l'enseignant.
 * 
 * À exécuter manuellement via : node scripts/fix_teacher_status_regression.js
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgres://Pledgeum_admin:Fa2BVCcYmysEiyx!!!@51.159.113.59:26093/rdb',
    // ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        const beginRes = await pool.query('BEGIN');

        // Requête de réparation selon la directive
        const updateQuery = `
      UPDATE conventions
      SET status = 'VALIDATED_TEACHER'
      WHERE metadata->'signatures'->'teacher' IS NOT NULL
      AND status IN ('DRAFT', 'SUBMITTED', 'SIGNED_PARENT')
      RETURNING id, status, metadata->>'ent_nom' as company_name;
    `;

        console.log("Exécution de la réparation SQL...");
        const result = await pool.query(updateQuery);

        await pool.query('COMMIT');

        console.log(`✅ Opération réussie. ${result.rowCount} conventions ont été corrigées.`);
        if (result.rowCount > 0) {
            console.log("Conventions impactées : ");
            console.table(result.rows);
        }

    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Erreur SQL lors de la réparation :', error);
    } finally {
        pool.end();
    }
}

run();
