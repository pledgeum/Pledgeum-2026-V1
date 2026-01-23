const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// 1. Load Env
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
    });
}

// 2. Init Admin
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

async function main() {
    console.log("🛠️  FIXING FIRESTORE CONTACTS FOR SANDBOX...");

    // A. Fix User Profile
    const email = 'pledgeum@gmail.com';
    const usersSnap = await db.collection('users').where('email', '==', email).get();

    if (usersSnap.empty) {
        console.error("❌ User not found in Firestore!");
    } else {
        const userDoc = usersSnap.docs[0];
        console.log(`✅ Found User ${userDoc.id} (${email}). Updating to school_head / 9999999X...`);

        await userDoc.ref.set({
            role: 'school_head',
            uai: '9999999X',
            schoolId: '9999999X', // Alias
            profileData: {
                ...userDoc.data().profileData,
                ecole_nom: 'Lycée Sandbox',
                function: 'Proviseur'
            },
            updatedAt: new Date().toISOString()
        }, { merge: true });
        console.log("✅ User updated.");

        // B. Fix Conventions
        console.log("🔍 Finding conventions linked to this user...");
        // Check userId OR studentId OR role emails
        // We do a broad search or just userId? User said "Conventions du compte". Likely ownership.
        const convSnap = await db.collection('conventions').where('userId', '==', userDoc.id).get();

        if (convSnap.empty) {
            console.log("⚠️ No conventions found directly owned by userId.");
        } else {
            console.log(`🔹 Found ${convSnap.size} owned conventions. Linking to 9999999X...`);
            const batch = db.batch();
            convSnap.docs.forEach(doc => {
                batch.update(doc.ref, {
                    schoolId: '9999999X',
                    ecole_nom: 'Lycée Sandbox',
                    establishment_uai: '9999999X' // Future proofing
                });
            });
            await batch.commit();
            console.log("✅ Conventions updated.");
        }
    }
    console.log("🏁 Done.");
}

main().catch(console.error);
