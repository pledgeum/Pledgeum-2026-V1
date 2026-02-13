const { Client } = require('pg');

const client = new Client({
    connectionString: "postgres://Pledgeum_admin:Fa2BVCcYmysEiyx!!!@51.159.113.59:26093/rdb",
    ssl: false // or { rejectUnauthorized: false } if needed, usually needed for cloud DBs but let's try without or strictly
});

async function run() {
    try {
        await client.connect();
        console.log("Connected to DB");

        // Fetch the most recently updated convention
        const res = await client.query(`
      SELECT id, status, metadata 
      FROM conventions 
      ORDER BY updated_at DESC 
      LIMIT 1;
    `);

        if (res.rows.length === 0) {
            console.log("No conventions found.");
        } else {
            const conv = res.rows[0];
            console.log("=== LATEST CONVENTION ===");
            console.log("ID:", conv.id);
            console.log("STATUS:", conv.status);
            console.log("RAW SIGNATURES (from metadata):");
            console.log(JSON.stringify(conv.metadata.signatures, null, 2));

            // Also check if signatures are stored in a separate column?
            // Based on previous code, we updated `metadata.signatures`.

            console.log("FULL METADATA KEYS:", Object.keys(conv.metadata));
        }

    } catch (err) {
        console.error("Database Error:", err);
    } finally {
        await client.end();
    }
}

run();
