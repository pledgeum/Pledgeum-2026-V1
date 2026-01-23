const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const admin = require('firebase-admin');

// 1. Load Environment Variables
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) process.env[k] = envConfig[k];
}

// 2. Init Firebase
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

// 3. Init Postgres
const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    console.log("🛠️  FIXING ADMIN ROLE INVERSION...");

    try {
        await client.connect();

        // A. INSPECT
        const email = 'fabrice.dumasdelage@gmail.com';
        console.log(`\n1. Checking User in Postgres: ${email}`);
        const res = await client.query("SELECT uid, email, role FROM users WHERE email = $1", [email]);

        let uid = null;
        if (res.rowCount > 0) {
            console.table(res.rows);
            uid = res.rows[0].uid;
        } else {
            console.log("⚠️ User not found in Postgres! Will insert/update.");
            // If not found, we need the UID from Firebase? Or just use email?
            // Users table uses UID as PK.
            // Let's fetch UID from Firebase first if unknown.
            const userRecord = await admin.auth().getUserByEmail(email).catch(() => null);
            if (userRecord) uid = userRecord.uid;
        }

        if (!uid) {
            // Need UID to proceed.
            const userRecord = await admin.auth().getUserByEmail(email);
            uid = userRecord.uid;
        }

        // B. FIX POSTGRES
        console.log(`\n2. Forcing School Head Role in Postgres for UID: ${uid}`);

        // Update User
        await client.query(`
            INSERT INTO users (uid, email, role, first_name, last_name)
            VALUES ($1, $2, 'school_head', 'Fabrice', 'Dumasdelage')
            ON CONFLICT (uid) DO UPDATE 
            SET role = 'school_head'
        `, [uid, email]);

        // C. FIX ESTABLISHMENT LINK
        console.log(`\n3. Linking Establishment 9999999X to ${email}`);
        // We set THIS user as the admin email for Sandbox
        await client.query(`
            UPDATE establishments 
            SET admin_email = $1 
            WHERE uai = '9999999X'
        `, [email]);

        // D. CLEANUP 'student_enrollments' (If exists)
        // Check if table exists
        const tableCheck = await client.query("SELECT to_regclass('public.student_enrollments')");
        if (tableCheck.rows[0].to_regclass) {
            console.log("\n4. Cleaning up 'student_enrollments'...");
            await client.query("DELETE FROM student_enrollments WHERE student_uid = $1", [uid]);
            console.log("✅ Deleted from enrollment.");
        } else {
            console.log("\n4. Table 'student_enrollments' does not exist. Skipping.");
        }

        // E. FIX FIRESTORE
        console.log(`\n5. Syncing to Firestore for ${uid}...`);
        const docRef = db.collection('users').doc(uid);
        await docRef.set({
            role: 'school_head',
            uai: '9999999X',
            schoolId: '9999999X',
            profileData: {
                firstName: 'Fabrice',
                lastName: 'Dumasdelage',
                ecole_nom: 'Lycée Sandbox',
                function: 'Proviseur'
            }
        }, { merge: true });
        console.log("✅ Firestore updated.");

    } catch (err) {
        console.error("❌ Error:", err);
    } finally {
        await client.end();
    }
}

main();
