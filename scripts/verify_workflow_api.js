
const { Pool } = require('pg');
const fetch = require('node-fetch'); // Ensure node-fetch is available or use native fetch if Node 18+

const pool = new Pool({
    connectionString: "postgres://Pledgeum_admin:Fa2BVCcYmysEiyx!!!@51.159.113.59:26093/rdb",
    ssl: { rejectUnauthorized: false }
});

async function verifyWorkflow() {
    const client = await pool.connect();
    const conventionId = 'wf_test_' + Math.random().toString(36).substr(2, 9);

    try {
        console.log("Setting up test convention...");

        // 0. Get a valid UAI
        const uaiRes = await client.query('SELECT uai FROM establishments LIMIT 1');
        const validUai = uaiRes.rows[0]?.uai;
        if (!validUai) throw new Error("No establishments found to test with.");

        // 1. Create a convention in DRAFT/SUBMITTED state
        // We need fields that are required by schema? No, DB constraints are loose usually.
        // But for updateConventionStatus logic, we need establishment_uai etc to exist?
        // workflow.ts reads establishment_uai.

        await client.query(`
            INSERT INTO conventions (id, student_uid, status, created_at, updated_at, metadata, establishment_uai)
            VALUES ($1, 'test_student', 'SUBMITTED', NOW(), NOW(), '{}', $2)
        `, [conventionId, validUai]);

        console.log(`Convention ${conventionId} created. Testing API...`);

        // 2. Call API to Sign as Parent
        // We assume the app is running at localhost:3000
        const res = await fetch(`http://localhost:3000/api/conventions/${conventionId}/sign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                role: 'parent',
                signatureImage: 'data:image/png;base64,fake',
                code: 'PARENT123'
            })
        });

        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`API Failed: ${res.status} ${txt}`);
        }

        const json = await res.json();
        console.log("API Response:", json);

        // 3. Verify Status in DB
        const checkRes = await client.query('SELECT status, metadata FROM conventions WHERE id = $1', [conventionId]);
        const row = checkRes.rows[0];

        console.log("DB Status:", row.status);
        console.log("DB Metadata Signatures:", row.metadata.signatures);

        if (row.status === 'SIGNED_PARENT' && row.metadata.signatures?.parentCode === 'PARENT123') {
            console.log("SUCCESS: Status transitioned and signature saved!");
        } else {
            console.error("FAILURE: Status or Signature incorrect.");
        }

    } catch (e) {
        console.error(e);
    } finally {
        // Cleanup
        await client.query('DELETE FROM conventions WHERE id = $1', [conventionId]);
        client.release();
        pool.end();
    }
}

// Check for native fetch (Node 18+) or try generic
if (!globalThis.fetch) {
    console.error("Node version too old for native fetch. Please use Node 18+");
    process.exit(1);
}

verifyWorkflow();
