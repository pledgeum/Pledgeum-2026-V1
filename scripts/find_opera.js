const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgres://Pledgeum_admin:Fa2BVCcYmysEiyx!!!@51.159.113.59:26093/rdb',
    // ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        const result = await pool.query(`
      SELECT metadata->>'tuteur_email' as tuteur_email, metadata->>'ent_nom' as ent_nom, metadata->>'ent_rep_email' as rep_email
      FROM conventions
      WHERE metadata->>'ent_nom' ILIKE '%OPERA%'
    `);
        console.log(JSON.stringify(result.rows, null, 2));
    } catch (e) {
        console.error('Error:', e);
    } finally {
        pool.end();
    }
}

run();
