const { Pool } = require('pg');

const pool = new Pool({
    connectionString: "postgres://Pledgeum_admin:Fa2BVCcYmysEiyx!!!@51.159.113.59:26093/rdb",
    ssl: { rejectUnauthorized: false }
});

async function cleanup() {
    console.log("Starting cleanup of bad hashes (9A01295A1C53)...");
    try {
        // 1. Identify records
        const check = await pool.query("SELECT id FROM conventions WHERE pdf_hash = '9A01295A1C53'");
        console.log(`Found ${check.rows.length} affected records.`);

        if (check.rows.length > 0) {
            // 2. Clear column
            const res = await pool.query("UPDATE conventions SET pdf_hash = NULL WHERE pdf_hash = '9A01295A1C53'");
            console.log(`Successfully cleared pdf_hash for ${res.rowCount} records.`);

            // 3. Clear from metadata if present
            const resMeta = await pool.query("UPDATE conventions SET metadata = metadata - 'pdfHash' WHERE metadata->>'pdfHash' = '9A01295A1C53'");
            console.log(`Successfully cleared pdfHash from metadata for ${resMeta.rowCount} records.`);

            const resMeta2 = await pool.query("UPDATE conventions SET metadata = metadata - 'pdf_hash' WHERE metadata->>'pdf_hash' = '9A01295A1C53'");
            console.log(`Successfully cleared pdf_hash from metadata for ${resMeta2.rowCount} records.`);
        }

        console.log("Cleanup completed.");
    } catch (err) {
        console.error("Cleanup failed:", err);
    } finally {
        await pool.end();
    }
}

cleanup();
