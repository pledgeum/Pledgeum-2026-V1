
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/pledgeum'
});

async function main() {
    const client = await pool.connect();
    try {
        console.log("--- Verifying Signature Token Persistence ---");

        // 1. Setup Test Convention
        const uaiRes = await client.query("SELECT uai FROM establishments LIMIT 1");
        const uai = uaiRes.rows[0]?.uai;
        if (!uai) throw new Error("No establishment found");

        const studentRes = await client.query("SELECT uid FROM users WHERE role = 'student' LIMIT 1");
        const studentId = studentRes.rows[0]?.uid || 'student_test_id';

        const insertRes = await client.query(`
            INSERT INTO conventions (
                id, student_uid, establishment_uai, status, metadata, created_at, updated_at
            ) VALUES (
                'verify_token_conv', $1, $2, 'DRAFT', '{}', NOW(), NOW()
            ) 
            ON CONFLICT (id) DO UPDATE SET status = 'DRAFT', metadata = '{}'
            RETURNING id
        `, [studentId, uai]);

        console.log("Created/Reset Convention:", insertRes.rows[0].id);

        // 2. Call API (mocked fetch) - we can't fetch strictly from node script without server running exposed? 
        // Correct, usually we need to run fetch against localhost:3000. 
        // Assuming the server IS running as per `npm run dev`.

        const fetch = (await import('node-fetch')).default;

        const payload = {
            role: 'student',
            signatureImage: 'data:image/png;base64,token_test',
            code: 'TOKEN-X-1234'
        };

        const res = await fetch('http://localhost:3000/api/conventions/verify_token_conv/sign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const json = await res.json();
        console.log("API Response:", JSON.stringify(json, null, 2));

        if (!json.success && !json.data) {
            throw new Error("API failed: " + JSON.stringify(json));
        }

        // 3. Verify DB Content
        const verifyRes = await client.query("SELECT metadata FROM conventions WHERE id = 'verify_token_conv'");
        const metadata = verifyRes.rows[0].metadata;

        console.log("DB Metadata:", JSON.stringify(metadata, null, 2));

        const signatures = metadata.signatures || {};
        const signatureId = signatures.studentSignatureId;
        const studentCode = signatures.studentCode;

        console.log("Signatures.studentSignatureId:", signatureId);
        console.log("Signatures.studentCode:", studentCode);

        if (signatureId === 'TOKEN-X-1234' && studentCode === 'TOKEN-X-1234') {
            console.log("SUCCESS: Token persisted as both 'studentCode' and 'studentSignatureId'!");
        } else {
            console.error("FAILURE: Token mismatch or missing.");
            process.exit(1);
        }

    } catch (e) {
        console.error("Error:", e);
        process.exit(1);
    } finally {
        // Cleanup
        await client.query("DELETE FROM conventions WHERE id = 'verify_token_conv'");
        client.release();
        await pool.end();
    }
}

main();
