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
        console.error('❌ Missing Firebase Credentials in .env.local');
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

const auth = admin.auth();

async function exportUsers() {
    console.log('🚀 Starting Auth Export...');
    const allUsers = [];
    let nextPageToken;

    try {
        do {
            const result = await auth.listUsers(1000, nextPageToken);
            result.users.forEach((userRecord) => {
                allUsers.push({
                    uid: userRecord.uid,
                    email: userRecord.email,
                    emailVerified: userRecord.emailVerified,
                    displayName: userRecord.displayName,
                    photoURL: userRecord.photoURL,
                    disabled: userRecord.disabled,
                    metadata: userRecord.metadata,
                    providerData: userRecord.providerData.map(p => ({
                        uid: p.uid,
                        displayName: p.displayName,
                        email: p.email,
                        photoURL: p.photoURL,
                        providerId: p.providerId,
                        phoneNumber: p.phoneNumber
                    }))
                });
            });
            nextPageToken = result.pageToken;
            if (nextPageToken) {
                console.log(`Fetched ${allUsers.length} users...`);
            }
        } while (nextPageToken);

        const outputPath = path.resolve(__dirname, '../backup_auth_users.json');
        fs.writeFileSync(outputPath, JSON.stringify(allUsers, null, 2));
        console.log(`✅ Auth Export completed! Saved ${allUsers.length} users to: ${outputPath}`);
        process.exit(0);

    } catch (error) {
        console.error('❌ Auth Export Error:', error);
        process.exit(1);
    }
}

exportUsers();
