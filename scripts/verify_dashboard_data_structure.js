
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

// Mock fetch if running in node without polyfill (though node 18+ has fetch)
// We need to hit the running server or mock the logic.
// Connecting to DB directly is easier to see what SHOULD be returned,
// but we want to see what the API MAPPING does.
// So we must hit the API endpoint.

async function main() {
    try {
        console.log("--- Verifying API JSON Structure ---");

        // We need a session... calling API without session returns 401.
        // We can't easily simulate session in a script hitting localhost:3000 unless we pass cookie.

        // ALTERNATIVE: Import the GET function? 
        // Next.js functions use `Request`/`NextResponse`. Hard to unit test in script.

        // Let's use the DB approach to Verify the raw data, 
        // AND simulate the mapping logic I added in route.ts to see if it works as expected.

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        const client = await pool.connect();
        const res = await client.query(`
            SELECT metadata FROM conventions WHERE status != 'DRAFT' LIMIT 1
        `);

        if (res.rowCount === 0) {
            console.log("No non-DRAFT conventions found.");
            return;
        }

        const row = res.rows[0];
        console.log("RAW DB Metadata:", JSON.stringify(row.metadata, null, 2));

        // Simulate the mapping I wrote in route.ts
        const mapped = {
            ...row,
            signatures: row.metadata?.signatures || {}
        };

        console.log("MAPPED Signatures:", JSON.stringify(mapped.signatures, null, 2));

        if (mapped.signatures && Object.keys(mapped.signatures).length > 0) {
            console.log("SUCCESS: Mapping logic works on raw data.");
        } else {
            console.error("FAILURE: Signatures empty or missing.");
        }

        client.release();
        pool.end();

    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

main();
