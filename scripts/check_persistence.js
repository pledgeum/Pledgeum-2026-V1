
const fetch = require('node-fetch'); // Assuming node-fetch is available or using native fetch in Node 18+

async function testPersistence() {
    try {
        console.log("--- Testing Persistence API (http://localhost:3000/api/sync/convention) ---");

        // Mock Payload mimicking Step2Student/Store output
        const payload = {
            id: `test_conv_${Date.now()}`,
            userId: 'test_user_persistence',
            studentId: 'test_user_persistence', // Should match userId for student
            eleve_email: 'test.persistence@example.com',
            eleve_nom: 'Test',
            eleve_prenom: 'Persistence',
            status: 'DRAFT',

            // Required fields based on Schema check
            ent_nom: 'Test Company',
            ent_ville: 'Paris',
            ent_code_postal: '75000',
            ent_adresse: '1 Rue Test',

            tuteur_email: 'tutor@test.com',
            tuteur_nom: 'Tutor Name',

            // Dates (ISO or YYYY-MM-DD)
            stage_date_debut: '2026-03-01',
            stage_date_fin: '2026-03-31',
            stage_duree_heures: 140,

            metadata: {
                source: 'verification_script'
            }
        };

        const res = await fetch('http://localhost:3000/api/sync/convention', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const contentType = res.headers.get("content-type");
        const isJson = contentType && contentType.includes("application/json");
        const text = await res.text();

        console.log(`Response Status: ${res.status} ${res.statusText}`);
        console.log("Response Body:", text);

        if (res.ok) {
            console.log("✅ SUCCESS: API accepted the payload.");
        } else {
            console.error("❌ FAILURE: API rejected the payload.");
            if (isJson) {
                try {
                    const json = JSON.parse(text);
                    console.error("Error Detail:", json.error);
                } catch (e) { /* ignore */ }
            }
        }

    } catch (e) {
        if (e.code === 'ECONNREFUSED') {
            console.error("❌ Connection Refused. Is the Next.js server running on port 3000?");
        } else {
            console.error("Error running test:", e);
        }
    }
}

testPersistence();
