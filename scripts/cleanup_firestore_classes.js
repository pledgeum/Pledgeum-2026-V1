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

// Init Firebase
if (!admin.apps.length) {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (privateKey) privateKey = privateKey.replace(/\\n/g, '\n');
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: privateKey,
            }),
            projectId: process.env.FIREBASE_PROJECT_ID
        });
    } catch (e) {
        console.error("Firebase Init Error:", e);
    }
}

const db = admin.firestore();

// DETERMINISTIC ID GENERATOR (Matching school.ts)
const generateClassId = (name) => {
    return name.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
};

async function main() {
    const schoolId = '9999999X'; // Sandbox
    const year = '2025-2026';
    const classesRef = db.collection(`establishments/${schoolId}/years/${year}/classes`);

    console.log(`🧹 Cleaning Firestore Classes for ${schoolId}...`);

    const snapshot = await classesRef.get();
    const classes = [];
    snapshot.forEach(doc => classes.push({ id: doc.id, data: doc.data() }));

    const grouped = new Map();
    classes.forEach(c => {
        const name = c.data.name || "UNKNOWN";
        if (!grouped.has(name)) grouped.set(name, []);
        grouped.get(name).push(c);
    });

    const batch = db.batch();
    let deletedCount = 0;

    for (const [name, list] of grouped) {
        const expectedId = generateClassId(name);

        // Find if the "Authorized" ID exists
        const official = list.find(c => c.id === expectedId);

        let targetMaster = official;

        if (!targetMaster) {
            // No official doc exists yet? Pick the first one and Migrate it?
            // Or create new?
            // Let's create/move to 'expectedId'.
            console.log(`   ✨ Migrating '${name}' to '${expectedId}'...`);
            const source = list[0]; // Pick first as source
            const newRef = classesRef.doc(expectedId);
            batch.set(newRef, { ...source.data, id: expectedId, uai: schoolId, updatedAt: new Date().toISOString() });
            targetMaster = { id: expectedId }; // Virtual master
        }

        // DELETE ALL OTHERS
        const victims = list.filter(c => c.id !== expectedId); // Delete even the source of migration (since we copied it)

        for (const v of victims) {
            console.log(`   ❌ Deleting Duplicate: ${v.id} (${v.data.name})`);
            batch.delete(classesRef.doc(v.id));
            deletedCount++;
        }
    }

    if (deletedCount > 0) {
        await batch.commit();
        console.log(`✅ Cleanup complete. Deleted ${deletedCount} duplicates.`);
    } else {
        console.log("✅ No duplicates found.");
    }
}

main();
