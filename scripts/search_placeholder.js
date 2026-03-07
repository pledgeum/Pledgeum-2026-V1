const { Pool } = require('pg');

async function search() {
    const pool = new Pool({
        connectionString: "postgres://Pledgeum_admin:Fa2BVCcYmysEiyx!!!@51.159.113.59:26093/rdb",
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log("Searching for 9A01295A1C53 in DB...");
        const res = await pool.query(`
            SELECT id, status, pdf_hash, metadata
            FROM conventions 
            WHERE pdf_hash = '9A01295A1C53'
            OR id::text ILIKE '%9A01295A1C53%'
            OR metadata::text ILIKE '%9A01295A1C53%'
        `);

        if (res.rowCount === 0) {
            console.log("Not found in database.");
        } else {
            console.log(`Found ${res.rowCount} matches:`);
            console.table(res.rows.map(r => ({ id: r.id, status: r.status, pdf_hash: r.pdf_hash })));
        }
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

search();
