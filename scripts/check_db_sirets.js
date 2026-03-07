const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function main() {
    const sirets = [
        "34308328300014",
        "34511757600016",
        "18004601300140",
        "69204158500039",
        "45132990802975"
    ];

    try {
        const placeholders = sirets.map((_, i) => `$${i + 1}`).join(',');
        const query = `
            SELECT siret, latitude, longitude
            FROM partners
            WHERE siret IN (${placeholders})
        `;
        const { rows } = await pool.query(query, sirets);
        console.log("Found rows:", rows.length);
        console.log("Rows:", rows);

        // Also check one siret specifically
        const query2 = `SELECT * FROM partners WHERE siret LIKE $1 LIMIT 1`;
        const { rows: rows2 } = await pool.query(query2, ['%343%']);
        console.log("Rows LIKE:", rows2);

    } catch (e) {
        console.error("Error", e);
    } finally {
        pool.end();
    }
}

main();
