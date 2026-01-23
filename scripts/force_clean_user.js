const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const admin = require('firebase-admin');

// Load .env.local
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

// Init Postgres
const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    ssl: { rejectUnauthorized: false }
});

// Init Firebase
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
    });
}

const TARGET_EMAIL = 'fabrice.dumasdelage@yahoo.fr';

async function main() {
    try {
        console.log('--- Cleaning Up User ---');

        // 1. Postgres Cleanup
        console.log('🔌 Connecting to Postgres...');
        await client.connect();

        console.log(`🔍 Postgres: Checking for user: ${TARGET_EMAIL}`);
        const checkRes = await client.query('SELECT * FROM users WHERE email = $1', [TARGET_EMAIL]);

        if (checkRes.rowCount === 0) {
            console.log('⚠️  Postgres: User not found. Nothing to delete.');
        } else {
            console.log(`✅ Postgres: Found ${checkRes.rowCount} user(s). Deleting...`);
            const deleteRes = await client.query('DELETE FROM users WHERE email = $1', [TARGET_EMAIL]);
            console.log(`🗑️  Postgres: Deleted ${deleteRes.rowCount} row(s).`);
        }
        await client.end();

        // 2. Firebase Cleanup
        console.log(`🔍 Firebase: Checking for user: ${TARGET_EMAIL}`);
        try {
            const userRecord = await admin.auth().getUserByEmail(TARGET_EMAIL);
            console.log(`✅ Firebase: Found user UID: ${userRecord.uid}. Deleting...`);
            await admin.auth().deleteUser(userRecord.uid);
            console.log(`🗑️  Firebase: User deleted.`);
        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                console.log('⚠️  Firebase: User not found. Nothing to delete.');
            } else {
                console.error('❌ Firebase Error:', error);
            }
        }

        console.log('\n--- Cleanup Complete ---');
        console.log("You can now retry the Sign-Up flow.");

    } catch (err) {
        console.error('❌ Error executing script:', err);
        // Ensure client is closed even on error
        try { await client.end(); } catch (e) { }
    }
}

main();
