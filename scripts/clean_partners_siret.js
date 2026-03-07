const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function main() {
    try {
        const querySelect = `SELECT count(*) FROM partners WHERE siret LIKE '% %'`;
        const resSelect = await pool.query(querySelect);
        console.log(`Données corrompues trouvées : ${resSelect.rows[0].count} partenaires avec des espaces dans le SIRET.`);

        const queryUpdate = `
            UPDATE partners 
            SET siret = REPLACE(siret, ' ', '')
            WHERE siret LIKE '% %'
        `;
        const resUpdate = await pool.query(queryUpdate);
        console.log(`Nettoyage terminé : ${resUpdate.rowCount} lignes mises à jour dans la table partners.`);

    } catch (e) {
        console.error("Error", e);
    } finally {
        pool.end();
    }
}

main();
