require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function audit() {
    try {
        const res = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE latitude IS NULL OR longitude IS NULL OR latitude = 0 OR longitude = 0) as missing_coords,
        COUNT(*) FILTER (WHERE city IS NULL OR city = '') as missing_city
      FROM partners
    `);
        console.log("=== AUDIT TABLE PARTNERS ===");
        console.log(`Total entreprises: ${res.rows[0].total}`);
        console.log(`Sans coordonnées géographiques (GPS): ${res.rows[0].missing_coords}`);
        console.log(`Sans ville (city): ${res.rows[0].missing_city}`);
    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

audit();
