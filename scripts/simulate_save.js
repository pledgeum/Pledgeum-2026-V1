
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const config = {
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    ssl: { rejectUnauthorized: false }
};

const pool = new Pool(config);

async function simulateSave() {
    const client = await pool.connect();
    try {
        console.log("[SIMULATION] Connected to DB.");

        // 1. Find Student Tyméo
        const res = await client.query(`
            SELECT * FROM users 
            WHERE first_name ILIKE '%Tyméo%' 
            LIMIT 1
        `);

        if (res.rows.length === 0) {
            console.error("[SIMULATION] Student 'Tyméo' not found in DB.");
            return;
        }

        const student = res.rows[0];
        console.log(`[SIMULATION] Found Student: ${student.first_name} ${student.last_name} (UID: ${student.uid})`);

        // 2. Construct Payload
        // Mimic src/store/convention.ts MOCK_CONVENTION structure
        const payload = {
            id: `conv_simu_${Date.now()}`, // unique ID
            studentId: student.uid,
            userId: student.uid, // The store might send this too
            schoolId: student.establishment_uai, // As expected by store

            // Convention Data
            eleve_nom: student.last_name,
            eleve_prenom: student.first_name,
            eleve_email: student.email,

            status: 'DRAFT',
            ent_nom: "Simulation Corp",
            ent_siret: "12345678901234",
            ent_ville: "Paris",
            tuteur_email: "tuteur.simu@pledgeum.fr",
            tuteur_nom: "Dupont",
            tuteur_prenom: "Jean",

            stage_date_debut: "2024-01-01",
            stage_date_fin: "2024-02-01",
            stage_duree_heures: 35
        };

        console.log("[SIMULATION] Payload ready. Sending to API...");

        // 3. Call API
        // Try fetch
        try {
            const response = await fetch('http://localhost:3000/api/sync/convention', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            console.log(`[SIMULATION] API Status: ${response.status} ${response.statusText}`);
            const json = await response.json();
            console.log("[SIMULATION] API Response:", JSON.stringify(json, null, 2));

            if (json.success) {
                console.log("✅ [VERDICT] API Logic is WORKING. The bug is likely in the Frontend UI (Button/Form/State).");
            } else {
                console.error("❌ [VERDICT] API Failed. The bug is in the API or Database logic.");
            }

        } catch (fetchErr) {
            console.error("[SIMULATION] Request Failed. Is the server running on port 3000?");
            console.error(fetchErr);
        }

    } catch (err) {
        console.error("Query Failed:", err);
    } finally {
        client.release();
        pool.end();
    }
}

simulateSave();
