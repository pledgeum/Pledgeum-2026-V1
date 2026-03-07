const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function main() {
    try {
        const queryCheck = `
            SELECT COUNT(*) FROM partners 
            WHERE siret ~ '[^0-9]'
        `;
        const resCheck = await pool.query(queryCheck);
        console.log(`Données corrompues (caractères invisibles/non-numériques) trouvées : ${resCheck.rows[0].count} partenaires.`);

        const queryUpdate = `
            UPDATE partners 
            SET siret = regexp_replace(siret, '[^0-9]', '', 'g')
            WHERE siret ~ '[^0-9]'
        `;
        const resUpdate = await pool.query(queryUpdate);
        console.log(`Nettoyage radical terminé : ${resUpdate.rowCount} lignes mises à jour dans la table partners.`);

    } catch (e) {
        console.error("Error", e);
    } finally {
        pool.end();
    }
}

main();
