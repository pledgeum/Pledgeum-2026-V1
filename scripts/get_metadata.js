const { Pool } = require('pg');
const pool = new Pool({
    connectionString: "postgres://Pledgeum_admin:Fa2BVCcYmysEiyx!!!@51.159.113.59:26093/rdb",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
});

async function run() {
    try {
        const res = await pool.query("SELECT * FROM conventions WHERE id = 'conv_9cysp0s3y'");
        if (res.rows.length > 0) {
            console.log(JSON.stringify(res.rows[0], null, 2));
        } else {
            console.log("NOT FOUND");
        }
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}
run();
