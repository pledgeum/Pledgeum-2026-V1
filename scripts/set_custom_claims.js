const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const admin = require('firebase-admin');

// 1. Load Environment Variables (Robust Method)
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
} else {
    console.warn("⚠️  .env.local not found, relying on process.env");
}

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        })
    });
}

const db = admin.firestore();

async function setClaims(email, claims) {
    try {
        const user = await admin.auth().getUserByEmail(email);
        await admin.auth().setCustomUserClaims(user.uid, claims);
        console.log(`✅ Claims set for ${email}:`, claims);

        // Also update the User Document to match, just in case rules use getUserData()
        await db.collection('users').doc(user.uid).set({
            role: claims.role,
            schoolId: claims.schoolId,
            uai: claims.schoolId
        }, { merge: true });
        console.log(`✅ Firestore Doc updated for ${email}`);

    } catch (error) {
        console.error(`❌ Error setting claims for ${email}:`, error.message);
    }
}

async function main() {
    console.log("🛠️  Aligning Custom Claims & Firestore Docs...");

    // 1. Fabrice (The Real Admin)
    await setClaims('fabrice.dumasdelage@gmail.com', {
        role: 'school_head',
        schoolId: '9999999X',
        uai: '9999999X'
    });

    // 2. Pledgeum (The Developer)
    await setClaims('pledgeum@gmail.com', {
        role: 'school_head',
        schoolId: '9999999X',
        uai: '9999999X'
    });

    console.log("\n⚠️  IMPORTANT: Users must sign out and sign back in for claims to take effect.");
    process.exit(0);
}

main();
