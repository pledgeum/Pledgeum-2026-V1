const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function main() {
    try {
        const queryCheck = `
            SELECT id, company_siret as siret, metadata->>'eleve_nom' as nom, metadata->>'eleve_prenom' as prenom
            FROM conventions
            WHERE status != 'DRAFT'
            AND (company_siret IS NULL OR company_siret = '' OR company_siret NOT IN (SELECT siret FROM partners))
        `;
        const resCheck = await pool.query(queryCheck);
        console.log(`Conventions défaillantes trouvées : ${resCheck.rows.length}`);

        resCheck.rows.forEach(r => {
            console.log(`- ID: ${r.id} | ${r.prenom} ${r.nom} (SIRET corrompu/vide: '${r.siret}')`);
        });

        if (resCheck.rows.length > 0) {
            const ids = resCheck.rows.map(r => r.id);
            const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
            const queryDelete = `
                DELETE FROM conventions 
                WHERE id IN (${placeholders})
            `;
            const resDelete = await pool.query(queryDelete, ids);
            console.log(`Nettoyage terminé : ${resDelete.rowCount} conventions de test supprimées.`);
        } else {
            console.log("Aucune convention défaillante à supprimer.");
        }

    } catch (e) {
        console.error("Error", e);
    } finally {
        pool.end();
    }
}

main();
