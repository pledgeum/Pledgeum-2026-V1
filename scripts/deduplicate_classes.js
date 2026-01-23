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

// Init Firebase
if (!admin.apps.length) {
    // Service Account Logic
    // We try to read FIREBASE_PRIVATE_KEY from env, handling newlines
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (privateKey) {
        privateKey = privateKey.replace(/\\n/g, '\n');
    }

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
        // Continue but warn
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
        console.log("✅ PostgreSQL Connected.");

        // 1. ADD COLUMN establishment_uai
        console.log("🛠️  Adding 'establishment_uai' column...");
        await client.query(`
            ALTER TABLE classes 
            ADD COLUMN IF NOT EXISTS establishment_uai VARCHAR(8); -- No FK yet to avoid strict errors during fix
        `);

        // 2. SET DEFAULT UAI (Sandbox 9999999X) for orphans
        // We assume for this cleanup that NULL means Sandbox
        console.log("🛠️  Setting default UAI for orphans...");
        await client.query(`
            UPDATE classes 
            SET establishment_uai = '9999999X' 
            WHERE establishment_uai IS NULL
        `);

        // 3. IDENTIFY DUPLICATES
        console.log("🔍 Analyzing duplicates...");
        const res = await client.query(`
            SELECT * FROM classes WHERE establishment_uai = '9999999X' ORDER BY created_at ASC
        `);
        const classes = res.rows;

        const map = new Map(); // Name -> [Rows]
        classes.forEach(c => {
            const name = c.name.trim(); // Normalize?
            if (!map.has(name)) map.set(name, []);
            map.get(name).push(c);
        });

        const duplicatesMap = new Map();
        for (const [name, list] of map) {
            if (list.length > 1) {
                duplicatesMap.set(name, list);
            }
        }

        console.log(`Found ${duplicatesMap.size} class names with duplicates.`);

        // 4. CLEANUP LOOP
        for (const [name, list] of duplicatesMap) {
            console.log(`\nProcessing '${name}' (${list.length} entries)...`);

            // Strategy: Keep First Created? Or Last?
            // Usually First is safer (ID stability), unless Last has corrected data?
            // Let's Keep the FIRST one.
            const master = list[0];
            const victims = list.slice(1);
            const victimIds = victims.map(v => v.id);

            console.log(`   -> Master: ${master.id}`);
            console.log(`   -> Victims: ${victimIds.join(', ')}`);

            // A. Update Conventions
            // Check if class_id column exists in users table? (Safe check)
            // Just assume conventions for now based on known schema.

            // Update Conventions
            const updRes = await client.query(`
                UPDATE conventions 
                SET class_id = $1 
                WHERE class_id = ANY($2)
            `, [master.id, victimIds]);
            if (updRes.rowCount > 0) console.log(`   -> Reassigned ${updRes.rowCount} conventions.`);

            // B. Delete Victims from PG
            await client.query(`
                DELETE FROM classes WHERE id = ANY($1)
            `, [victimIds]);
            console.log(`   -> Deleted ${victimIds.length} rows from PG.`);

            // C. Delete Victims from Firestore
            for (const vid of victimIds) {
                const docPath = `establishments/9999999X/classes/${vid}`;
                try {
                    await db.doc(docPath).delete();
                    console.log(`   -> Firestore: Deleted ${docPath}`);
                } catch (e) {
                    console.warn(`   -> Firestore Error deleting ${docPath}:`, e.message);
                }
            }
        }

        // 5. ADD CONSTRAINT
        console.log("\n🔒 Adding UNIQUE constraint...");
        // First, check if duplicate names exist (safety check)
        const check = await client.query(`
            SELECT name, COUNT(*) 
            FROM classes 
            WHERE establishment_uai = '9999999X' 
            GROUP BY name 
            HAVING COUNT(*) > 1
        `);

        if (check.rowCount === 0) {
            try {
                await client.query(`
                    ALTER TABLE classes 
                    ADD CONSTRAINT unique_class_per_establishment UNIQUE (establishment_uai, name);
                `);
                console.log("✅ Constraint added successfully.");
            } catch (cerr) {
                if (cerr.code === '42710') { // duplicate_object
                    console.log("⚠️ Constraint already exists.");
                } else {
                    throw cerr;
                }
            }
        } else {
            console.error("❌ Impossible to add constraint: Duplicates still exist!", check.rows);
        }

        // 6. FINAL REPORT
        const finalCount = await client.query("SELECT COUNT(*) FROM classes WHERE establishment_uai = '9999999X'");
        console.log(`\n📊 Final Unique Classes Count: ${finalCount.rows[0].count}`);

    } catch (err) {
        console.error("❌ Fatal Error:", err);
    } finally {
        await client.end();
    }
}

main();
