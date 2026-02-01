import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env vars from .env.local or .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function main() {
    console.log("1. Connecting to DB...");
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log("2. Finding student 'Tyméo'...");
        const res = await pool.query("SELECT * FROM users WHERE first_name ILIKE '%Tyméo%' OR last_name ILIKE '%Tyméo%' LIMIT 1");

        if (res.rows.length === 0) {
            console.error("❌ Student 'Tyméo' not found in DB.");
            process.exit(1);
        }

        const student = res.rows[0];
        console.log(`✅ Found Student: ${student.first_name} ${student.last_name} (ID: ${student.id}, UID: ${student.uid})`);

        // Use the ID from the users table (id or uid?). 
        // The store sends 'studentId'.
        // Let's assume the store sends the student's User ID (which might be the firebase UID or the postgres UUID).
        // In the store fetchConventions maps 'student_uid' to 'studentId'.
        // So we should probably send the one that corresponds to student_uid in DB.
        // Let's print both.
        const studentIdToUse = student.uid;

        if (!studentIdToUse) {
            console.log("Warning: User has no UID. Using ID instead? No, Convention likely links to UID.");
        }

        const payload = {
            id: 'simulated_save_' + Date.now(),
            studentId: studentIdToUse,
            userId: 'simulated_admin',
            // ... required fields from ConventionData
            type: 'PFMP_STANDARD',
            language: 'fr',
            ecole_nom: 'Ecolee Test',
            ecole_adresse: '123 Fake St',
            ecole_tel: '0102030405',
            ecole_chef_nom: 'Principal Skinner',
            ecole_chef_email: 'skinner@example.com',
            prof_nom: 'Ms Krabappel',
            prof_email: 'krabappel@example.com',
            eleve_nom: student.last_name,
            eleve_prenom: student.first_name,
            eleve_date_naissance: '2005-01-01',
            eleve_adresse: 'Home',
            eleve_cp: '75000',
            eleve_ville: 'Paris',
            eleve_email: student.email,
            eleve_classe: '2NDE',
            diplome_intitule: 'Bac',
            ent_nom: 'Moe Tavern',
            ent_adresse: 'Evergreen Tce',
            ent_code_postal: '75000',
            ent_ville: 'Springfield',
            ent_rep_nom: 'Moe',
            ent_rep_function: 'Bartender',
            ent_rep_email: 'moe@example.com',
            ent_rep_fonction: 'Gerant',
            tuteur_nom: 'Barney',
            tuteur_fonction: 'Client',
            tuteur_email: 'barney@example.com',
            stage_date_debut: '2024-01-01',
            stage_date_fin: '2024-02-01',
            stage_duree_heures: 35,
            stage_activites: 'Drinking Duff',
            status: 'SUBMITTED',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            signatures: {
                studentAt: new Date().toISOString(),
            }
        };

        console.log("3. Sending Payload to API...");
        console.log("Payload:", JSON.stringify(payload, null, 2));

        const response = await fetch('http://localhost:3000/api/sync/convention', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        console.log(`Response Status: ${response.status}`);
        const text = await response.text();
        console.log("Response Body:", text);

        if (response.ok) {
            console.log("✅ API Success");
        } else {
            console.log("❌ API Failed");
        }

    } catch (err) {
        console.error("❌ Error:", err);
    } finally {
        await pool.end();
    }
}

main();
