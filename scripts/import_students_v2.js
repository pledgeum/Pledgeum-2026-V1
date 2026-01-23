const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const Papa = require('papaparse');
const admin = require('firebase-admin');

// ------------------------------------------------------------------
// CONFIG & ENV LOADING
// ------------------------------------------------------------------
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

// ------------------------------------------------------------------
// FIREBASE INIT
// ------------------------------------------------------------------
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
        console.log("🔥 Firebase Admin Initialized.");
    } catch (e) {
        console.error("⚠️ Failed to init Firebase:", e.message);
    }
}
const db = admin.firestore();

// ------------------------------------------------------------------
// POSTGRES CLIENT
// ------------------------------------------------------------------
const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    ssl: { rejectUnauthorized: false }
});

// ------------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------------
function normalizeString(str) {
    if (!str) return '';
    return str.trim().toUpperCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove accents
}

// Generate Triplet Key: LASTNAME|FIRSTNAME|YYYY-MM-DD
function getTripletKey(last, first, dob) {
    return `${normalizeString(last)}|${normalizeString(first)}|${dob}`;
}

async function main() {
    try {
        await client.connect();
        console.log("✅ PostgreSQL Connected.");

        // CONFIG
        const TARGET_UAI = '9999999X';
        const SCHOOL_YEAR = '2025-2026';
        const CSV_FILE = path.resolve(__dirname, 'students_import_v2.csv');

        // ENSURE SCHEMA (Dependencies)
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS class_id VARCHAR(50);`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS establishment_uai VARCHAR(8);`);


        // Sample Data if missing
        if (!fs.existsSync(CSV_FILE)) {
            console.log("⚠️ Input file not found. Creating a DUMMY sample file...");
            const dummyData = `nom,prenom,naissance,email,classe
DUMAS,Fabrice,1985-05-20,fabrice.new@pledgeum.fr,2NDE 1
DOE,John,2008-01-01,john.doe@pledgeum.fr,1ERE AGORA
MARTIN,Alice,2009-02-15,alice.martin@pledgeum.fr,2NDE 1
NEW,Student,2010-06-10,new.student@pledgeum.fr,T.ASSP 1`;
            fs.writeFileSync(CSV_FILE, dummyData);
        }

        // 1. READ CSV
        const fileContent = fs.readFileSync(CSV_FILE, 'utf8');
        const parsed = Papa.parse(fileContent, { header: true, skipEmptyLines: true });
        const importRows = parsed.data;
        console.log(`📂 Read ${importRows.length} rows from CSV.`);

        const stats = {
            classesCreated: 0,
            studentsCreated: 0,
            studentsUpdated: 0,
            studentsArchived: 0,
            errors: 0
        };

        const batch = db.batch(); // Firestore Batch

        // ------------------------------------------------------------------
        // STEP A: PROCESS CLASSES (First Pass)
        // ------------------------------------------------------------------
        console.log("\n🏫 Processing Classes...");
        const uniqueClassNames = new Set();
        importRows.forEach(row => {
            const cName = row.classe || row.CLASSE || row.CLASSES;
            if (cName) uniqueClassNames.add(cName);
        });

        for (const classeName of uniqueClassNames) {
            try {
                const simpleClassId = normalizeString(classeName).replace(/[^A-Z0-9-]/g, '');
                const pgClassId = `${simpleClassId}_${TARGET_UAI}`;

                // Check if exists in PG (to count "Created")
                const checkRes = await client.query('SELECT 1 FROM classes WHERE id = $1', [pgClassId]);
                const exists = checkRes.rowCount > 0;

                // PG Upsert (Always ensure it exists and name is current)
                await client.query(`
                    INSERT INTO classes (id, name, establishment_uai, updated_at)
                    VALUES ($1, $2, $3, NOW())
                    ON CONFLICT (establishment_uai, name) DO UPDATE SET updated_at = NOW()
                `, [pgClassId, classeName, TARGET_UAI]);

                if (!exists) stats.classesCreated++;

                // Firestore Upsert (Simple ID)
                const fsClassRef = db.doc(`establishments/${TARGET_UAI}/years/${SCHOOL_YEAR}/classes/${simpleClassId}`);
                batch.set(fsClassRef, {
                    id: simpleClassId,
                    name: classeName,
                    uai: TARGET_UAI,
                    academicYear: SCHOOL_YEAR,
                    updatedAt: new Date().toISOString()
                }, { merge: true });

            } catch (err) {
                console.error(`❌ Error processing class '${classeName}':`, err.message);
                stats.errors++;
            }
        }

        // ------------------------------------------------------------------
        // STEP B: PREPARE EXISTING USERS (Triplet Map)
        // ------------------------------------------------------------------
        const existingQuery = await client.query(`
            SELECT uid, email, first_name, last_name, birth_date, class_id, is_active
            FROM users 
            WHERE establishment_uai = $1 AND role = 'student'
        `, [TARGET_UAI]);

        const existingMap = new Map(); // Key: TRIPLET -> User
        existingQuery.rows.forEach(u => {
            const dob = u.birth_date ? new Date(u.birth_date).toISOString().split('T')[0] : 'UNKNOWN';
            const key = getTripletKey(u.last_name, u.first_name, dob);
            existingMap.set(key, u);
        });

        console.log(`🔍 Found ${existingQuery.rowCount} existing students in DB for this UAI.`);

        // ------------------------------------------------------------------
        // STEP C: PROCESS STUDENTS (Second Pass)
        // ------------------------------------------------------------------
        console.log("\n🎓 Processing Students...");
        const processedUIDs = new Set();
        const pendingEmails = []; // { uid, email } to flush if needed, though we do it inline.

        for (const row of importRows) {
            const nom = row.nom || row.NOM;
            const prenom = row.prenom || row.PRENOM;
            const rawDob = row.naissance || row.DATENAISS || row['DATE NAISS'];
            const email = row.email || row.EMAIL;
            const classeName = row.classe || row.CLASSE || row.CLASSES;

            // Date Normalization (DD/MM/YYYY -> YYYY-MM-DD)
            let dob = rawDob;
            if (rawDob && rawDob.includes('/')) {
                const parts = rawDob.split('/');
                if (parts.length === 3) dob = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }

            if (!nom || !prenom || !dob) {
                console.warn(`⚠️ Skipping row missing essential data: ${nom} ${prenom}`);
                continue;
            }

            // Derive IDs
            const simpleClassId = normalizeString(classeName).replace(/[^A-Z0-9-]/g, '');
            const pgClassId = `${simpleClassId}_${TARGET_UAI}`;
            const tripletKey = getTripletKey(nom, prenom, dob); // STRICT UPPERCASE CHECK

            try {
                let uid;

                if (existingMap.has(tripletKey)) {
                    // Update Existing
                    const existing = existingMap.get(tripletKey);
                    uid = existing.uid;
                    let hasUpdates = false;

                    // --- SELF-HEALING AUTH (LIVENESS CHECK) ---
                    try {
                        // 1. Verify if this UID actually exists in Firebase
                        await admin.auth().getUser(uid);
                        // log("Skipping Auth (Link Valid)");
                    } catch (e) {
                        if (e.code === 'auth/user-not-found') {
                            // 2. The UID is dead! Trigger Repair.
                            const newUid = `student-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                            console.log(`   💀 Dead UID detected for ${nom} ${prenom} (Old: ${uid}). Repairing...`);

                            try {
                                // Create new Auth User
                                await admin.auth().createUser({
                                    uid: newUid,
                                    email: email || `${newUid}@missing.email`,
                                    displayName: `${prenom} ${nom}`,
                                    password: 'InitialPassword123!'
                                });
                                await admin.auth().setCustomUserClaims(newUid, { role: 'student', schoolId: TARGET_UAI });

                                // Update Postgres
                                await client.query('UPDATE users SET uid = $1 WHERE uid = $2', [newUid, uid]);
                                console.log(`   🔧 Repaired Broken Auth Link (New UID: ${newUid})`);

                                uid = newUid; // Update local var so subsequent updates use the new UID
                                stats.studentsUpdated++;
                            } catch (repairErr) {
                                console.error(`   ❌ Repair Failed for ${nom}:`, repairErr.message);
                            }
                        } else {
                            console.warn(`   ⚠️ Auth Check Error for ${uid}:`, e.code, e.message);
                        }
                    }
                    // --- SELF-HEALING AUTH END ---

                    // 1. Email Logic
                    if (email && normalizeString(existing.email) !== normalizeString(email)) {
                        console.log(`   🔄 Updating Email for ${nom}: ${existing.email} -> ${email}`);
                        await client.query('UPDATE users SET email = $1 WHERE uid = $2', [email, uid]);

                        try {
                            await admin.auth().updateUser(uid, { email: email });
                        } catch (e) {
                            console.warn(`     ⚠️ Firebase Auth Email Update Warning: ${e.message}`);
                        }
                        hasUpdates = true;
                    }

                    // 2. Class/Active Update
                    if (existing.class_id !== pgClassId || !existing.is_active) {
                        await client.query('UPDATE users SET class_id = $1, is_active = TRUE WHERE uid = $2', [pgClassId, uid]);
                        hasUpdates = true;
                    }

                    if (hasUpdates) stats.studentsUpdated++;

                } else {
                    // Create New
                    uid = `student-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                    console.log(`   ✨ Creating User: ${nom} ${prenom} (${uid})`);

                    await client.query(`
                        INSERT INTO users (uid, email, role, first_name, last_name, birth_date, establishment_uai, class_id, is_active, created_at)
                        VALUES ($1, $2, 'student', $3, $4, $5, $6, $7, TRUE, NOW())
                    `, [uid, email, prenom, nom, dob, TARGET_UAI, pgClassId]);

                    // Firebase Auth
                    try {
                        await admin.auth().createUser({
                            uid: uid,
                            email: email || `${uid}@missing.email`,
                            displayName: `${prenom} ${nom}`,
                            password: 'InitialPassword123!'
                        });
                        await admin.auth().setCustomUserClaims(uid, { role: 'student', schoolId: TARGET_UAI });
                    } catch (e) {
                        // If email conflict but different triplet -> Collision or reuse?
                        console.warn(`     ⚠️ Auth Create Warning: ${e.message}`);
                    }
                    stats.studentsCreated++;
                }

                processedUIDs.add(uid);

                // Firestore Sync (Active)
                const fsStudentRef = db.doc(`establishments/${TARGET_UAI}/years/${SCHOOL_YEAR}/students/${uid}`);
                batch.set(fsStudentRef, {
                    id: uid,
                    firstName: prenom,
                    lastName: nom,
                    email: email,
                    birthDate: dob,
                    classId: simpleClassId,
                    className: classeName,
                    uai: TARGET_UAI,
                    status: 'active',
                    updatedAt: new Date().toISOString()
                }, { merge: true });

            } catch (rowErr) {
                console.error(`   ❌ Error processing student ${nom} ${prenom}:`, rowErr.message);
                stats.errors++;
            }
        }

        // 4. ARCHIVE MISSING (In this UAI)
        // Only archive students who were IN this UAI but NOT in the import
        for (const [key, user] of existingMap) {
            if (!processedUIDs.has(user.uid)) {
                // Determine if we should really archive? 
                // Yes, import usually overrides current state.
                console.log(`   📦 Archiving: ${user.first_name} ${user.last_name}`);
                await client.query('UPDATE users SET is_active = FALSE WHERE uid = $1', [user.uid]);
                const fsStudentRef = db.doc(`establishments/${TARGET_UAI}/years/${SCHOOL_YEAR}/students/${user.uid}`);
                batch.set(fsStudentRef, { status: 'inactive', leftAt: new Date().toISOString() }, { merge: true });
                stats.studentsArchived++;
            }
        }

        await batch.commit();
        console.log("\n🔥 Firestore Sync Completed.");

        // FINAL REPORT
        console.log("\n📊 RAPPORT D'IMPORT :");
        console.log(`Classes Créées : ${stats.classesCreated}`);
        console.log(`Élèves Créés   : ${stats.studentsCreated}`);
        console.log(`Élèves MAJ     : ${stats.studentsUpdated}`);
        console.log(`(Archives : ${stats.studentsArchived} | Erreurs : ${stats.errors})`);

    } catch (err) {
        console.error("❌ Fatal Error:", err);
    } finally {
        await client.end();
    }
}

main();
