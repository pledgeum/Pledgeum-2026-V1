const { Client } = require('pg');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load .env.local
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

// Helper: Initialize Firebase Admin (Only once)
if (!admin.apps.length) {
    try {
        const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH || path.resolve(__dirname, '../serviceAccountKey.json');

        let serviceAccount;
        if (process.env.FIREBASE_PRIVATE_KEY) {
            serviceAccount = {
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            };
        } else if (fs.existsSync(serviceAccountPath)) {
            serviceAccount = require(serviceAccountPath);
        }

        if (serviceAccount) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        }
    } catch (e) {
        console.error("Firebase Init Error:", e);
    }
}

const db = admin.firestore();
const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        await client.connect();

        console.log("=== POSTGRESQL CLASSES INSPECTION ===");
        const pgRes = await client.query(`
            SELECT id, name, establishment_uai, created_at 
            FROM classes 
            ORDER BY name
        `);
        console.table(pgRes.rows);

        console.log("\n=== FIRESTORE CLASSES INSPECTION (Sandbox: 9999999X) ===");
        const year = "2025-2026";
        const schoolId = "9999999X";
        const classesRef = db.collection(`establishments/${schoolId}/years/${year}/classes`);
        const snapshot = await classesRef.get();

        const fsClasses = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            fsClasses.push({
                docId: doc.id,
                name: data.name,
                uai: data.uai || 'N/A'
            });
        });
        console.table(fsClasses);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.end();
    }
}

main();
