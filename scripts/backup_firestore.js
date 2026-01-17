const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// 1. Load Environment Variables from .env.local manually
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    console.log('Loading .env.local...');
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^["']|["']$/g, ''); // Remove quotes
            process.env[key] = value;
        }
    });
} else {
    console.error('❌ .env.local file not found. Please ensure credentials are set.');
    process.exit(1);
}

// 2. Initialize Firebase Admin
if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
        console.error('❌ Missing Firebase Credentials in .env.local (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)');
        process.exit(1);
    }

    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                clientEmail,
                privateKey: privateKey.replace(/\\n/g, '\n'),
            })
        });
        console.log('✅ Firebase Admin Initialized');
    } catch (error) {
        console.error('❌ Firebase Init Error:', error);
        process.exit(1);
    }
}

const db = admin.firestore();

// 3. Backup Logic (Recursive)
async function backupCollection(collectionRef) {
    const snapshot = await collectionRef.get();
    const data = {};

    for (const doc of snapshot.docs) {
        const docData = doc.data();
        const docId = doc.id;

        // Handle Datetimes converting to string? 
        // For JSON serialization, Date objects or Firestore Timestamps need handling.
        // We'll let JSON.stringify handle basic types, but Timestamps might show as objects.
        // Better to convert Timestamps to ISO strings if needed, but for simple backup:

        const subcollections = await doc.ref.listCollections();
        const subData = {};

        if (subcollections.length > 0) {
            for (const subCol of subcollections) {
                subData[subCol.id] = await backupCollection(subCol);
            }
        }

        data[docId] = {
            ...docData,
            ...(Object.keys(subData).length > 0 ? { __subcollections__: subData } : {})
        };
    }
    return data;
}

async function runBackup() {
    console.log('🚀 Starting Backup...');
    const collections = await db.listCollections();
    const backupData = {};

    for (const col of collections) {
        console.log(`Processing collection: ${col.id}...`);
        backupData[col.id] = await backupCollection(col);
    }

    const outputPath = path.resolve(__dirname, '../backup_pledgeum_data.json');
    fs.writeFileSync(outputPath, JSON.stringify(backupData, null, 2));
    console.log(`✅ Backup completed! Saved to: ${outputPath}`);
    process.exit(0);
}

runBackup().catch(err => {
    console.error('❌ Backup Failed:', err);
    process.exit(1);
});
