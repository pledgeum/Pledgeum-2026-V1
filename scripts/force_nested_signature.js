const { Client } = require('pg');

const client = new Client({
    connectionString: "postgres://Pledgeum_admin:Fa2BVCcYmysEiyx!!!@51.159.113.59:26093/rdb",
    ssl: false
});

async function run() {
    try {
        await client.connect();
        console.log("Connected to DB");

        const conventionId = 'conv_y8nfmpre1'; // The one we saw earlier

        // 1. Fetch current metadata
        const res = await client.query('SELECT metadata FROM conventions WHERE id = $1', [conventionId]);
        if (res.rowCount === 0) {
            console.log("Convention not found");
            return;
        }
        const currentMetadata = res.rows[0].metadata;

        // 2. Prepare Nested Signature Data
        const newSignatureData = {
            student: {
                signedAt: new Date().toISOString(),
                name: "Test Student (Forced)",
                hash: "da39a3ee5e6b4b0d3255bfef95601890afd80709", // specific hash (SHA1 of empty, just dummy)
                img: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKwKwQAAAABJRU5ErkJggg==", // Red dot
                code: "TEST-CODE",
                signatureId: "TEST-SIG-ID"
            },
            // Valid for existing student signature too?
            // Let's keep existing flat keys in metadata to be safe
        };

        const newMetadata = {
            ...currentMetadata,
            signatures: {
                ...(currentMetadata.signatures || {}), // Keep existing if any (likely undefined or flat obj if buggy)
                ...newSignatureData
            }
        };

        // 3. Update DB
        await client.query('UPDATE conventions SET metadata = $1 WHERE id = $2', [JSON.stringify(newMetadata), conventionId]);
        console.log("Updated convention with nested signature data.");

    } catch (err) {
        console.error("Database Error:", err);
    } finally {
        await client.end();
    }
}

run();
