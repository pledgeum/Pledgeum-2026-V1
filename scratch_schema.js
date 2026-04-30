const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://Pledgeum_admin:Fa2BVCcYmysEiyx!!!@51.15.201.169:11844/rdb',
});
async function checkSchema() {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'classes';
        `);
        console.table(res.rows);
    } finally {
        client.release();
        pool.end();
    }
}
checkSchema();
