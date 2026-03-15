const { Pool } = require('pg');
const pool = new Pool({
    connectionString: "postgres://Pledgeum_admin:Fa2BVCcYmysEiyx!!!@51.159.113.59:26093/rdb",
    ssl: { rejectUnauthorized: false }
});
pool.query("SELECT metadata FROM conventions WHERE id = (SELECT convention_id FROM mission_orders WHERE id = 21)")
    .then(res => { console.log(JSON.stringify(res.rows[0], null, 2)); process.exit(0); })
    .catch(e => { console.error(e); process.exit(1); });
