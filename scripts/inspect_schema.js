const { Pool } = require('pg');
const pool = new Pool({
    user: 'Pledgeum_admin',
    host: '51.159.113.59',
    database: 'rdb',
    password: 'Fa2BVCcYmysEiyx!!!',
    port: 26093,
    ssl: { rejectUnauthorized: false }
});

async function checkSchema() {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'conventions'
        `);
        console.log("Conventions Table Columns:");
        res.rows.forEach(r => console.log(` - ${r.column_name} (${r.data_type})`));
    } catch (err) {
        console.error(err);
    } finally {
        client.release();
        await pool.end();
    }
}
checkSchema();
