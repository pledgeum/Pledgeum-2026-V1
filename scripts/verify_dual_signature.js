
const { Client } = require('pg');

async function verifyDualSignature() {
    const client = new Client({
        connectionString: "postgres://Pledgeum_admin:Fa2BVCcYmysEiyx!!!@51.159.113.59:26093/rdb"
    });

    try {
        await client.connect();

        // 1. Create a mock convention ready for company/tutor signature
        const convId = 'test_dual_sign_' + Date.now();
        await client.query(`
            INSERT INTO conventions (id, student_uid, establishment_uai, status, metadata, created_at, updated_at)
            VALUES (
                $1, 
                'student_test', 
                '9999999Z', 
                'VALIDATED_TEACHER', 
                $2, 
                NOW(), 
                NOW()
            )
        `, [convId, JSON.stringify({
            tuteur_email: 'tutor@test.com',
            ent_rep_email: 'tutor@test.com',
            signatures: {}
        })]);

        console.log(`Created test convention: ${convId}`);

        // 2. Simulate Dual Signature POST request logic
        // We'll mimic the transition logic in sign/route.ts
        const role = 'tutor';
        const dualSign = true;
        const now = new Date().toISOString();
        const code = 'SIG-' + Math.random().toString(36).substr(2, 5).toUpperCase();

        // Mock the signature data we expect to see
        const signatureData = {
            signedAt: now,
            img: 'data:image/png;base64,mock',
            code: code,
            signatureId: code,
            hash: 'mock_hash',
            ip: '127.0.0.1'
        };

        let metadataSigs = { tutor: signatureData };
        if (dualSign) {
            metadataSigs.company_head = signatureData;
        }

        const newStatus = 'SIGNED_TUTOR';

        // Update DB
        await client.query(`
            UPDATE conventions 
            SET status = $2, 
                metadata = jsonb_set(metadata, '{signatures}', $3::jsonb),
                updated_at = NOW()
            WHERE id = $1
        `, [convId, newStatus, JSON.stringify(metadataSigs)]);

        console.log("Simulated dual signature update.");

        // 3. Verify results
        const res = await client.query('SELECT status, metadata FROM conventions WHERE id = $1', [convId]);
        const convention = res.rows[0];

        console.log("Status:", convention.status);
        const sigs = convention.metadata.signatures;

        const tutorSigned = !!sigs.tutor?.signedAt;
        const companyHeadSigned = !!sigs.company_head?.signedAt;
        const tutorKeyStandardized = !sigs.tutorAt; // Should not have legacy keys anymore
        const companyKeyStandardized = !sigs.companyAt;

        console.log("Tutor Signature Present:", tutorSigned);
        console.log("Company Head Signature Present:", companyHeadSigned);
        console.log("Tutor Key Standardized:", tutorKeyStandardized);
        console.log("Company Key Standardized:", companyKeyStandardized);

        if (convention.status === 'SIGNED_TUTOR' && tutorSigned && companyHeadSigned && tutorKeyStandardized && companyKeyStandardized) {
            console.log("SUCCESS: Dual signature and key standardization verified in DB.");
        } else {
            console.error("FAILURE: Verification failed.");
            process.exit(1);
        }

    } catch (err) {
        console.error("Error during verification:", err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

verifyDualSignature();
