const admin = require('firebase-admin');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env.local
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

// Configuration
const DRY_RUN = !process.argv.includes('--force');

async function main() {
    console.log(`\n🚀 Starting Cleanup Script - Mode: ${DRY_RUN ? 'DRY RUN (Simulation)' : 'LIVE EXECUTION'}`);
    if (DRY_RUN) {
        console.log("ℹ️  To execute deletion, run with --force");
    }

    // 1. Initialize Firebase Admin
    if (!admin.apps.length) {
        try {
            const privateKey = process.env.FIREBASE_PRIVATE_KEY
                ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
                : undefined;

            if (!privateKey) throw new Error("FIREBASE_PRIVATE_KEY is missing");

            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey,
                }),
            });
            console.log("✅ Firebase Admin initialized.");
        } catch (e) {
            console.error("❌ Failed to init Firebase Admin:", e.message);
            process.exit(1);
        }
    }

    // 2. Initialize Postgres
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
    });

    // Fallback if DATABASE_URL not set but components are
    if (!process.env.DATABASE_URL && process.env.POSTGRES_HOST) {
        client.config = {
            host: process.env.POSTGRES_HOST,
            port: process.env.POSTGRES_PORT,
            database: process.env.POSTGRES_DB,
            user: process.env.POSTGRES_USER,
            password: process.env.POSTGRES_PASSWORD,
            ssl: { rejectUnauthorized: false }
        };
    }

    try {
        await client.connect();
        console.log("✅ Postgres connected.");
    } catch (e) {
        console.error("❌ Failed to connect to Postgres:", e.message);
        process.exit(1);
    }

    try {
        // 3. Fetch All Postgres Users
        console.log("⏳ Fetching Postgres users...");
        // Checking for 'uid' column presence or fallback to 'id' if needed? 
        // Migration script uses 'uid'. robust check:
        const pgRes = await client.query('SELECT uid FROM users');
        const pgUids = new Set(pgRes.rows.map(r => r.uid));
        console.log(`📊 Postgres Users Found: ${pgUids.size}`);

        // 4. Scan Firebase Users
        console.log("⏳ Scanning Firebase Users...");
        let listUsersResult;
        let pageToken;
        let totalFirebaseUsers = 0;
        let orphans = [];

        do {
            listUsersResult = await admin.auth().listUsers(1000, pageToken);
            pageToken = listUsersResult.pageToken;

            listUsersResult.users.forEach(userRecord => {
                totalFirebaseUsers++;
                if (!pgUids.has(userRecord.uid)) {
                    orphans.push(userRecord.uid);
                }
            });
            process.stdout.write(`\r   Scanned: ${totalFirebaseUsers}...`);
        } while (pageToken);
        console.log(""); // Newline

        // 5. Report
        console.log("---------------------------------------------------");
        console.log(`Total Firebase Users Scanned: ${totalFirebaseUsers}`);
        console.log(`Total Postgres Users Found:   ${pgUids.size}`);
        console.log(`Orphans Identified:           ${orphans.length}`);
        console.log("---------------------------------------------------");

        if (DRY_RUN) {
            console.log(`✅ DRY RUN COMPLETE. No users were deleted.`);
            if (orphans.length > 0) {
                console.log(`⚠️  ${orphans.length} users would be deleted in LIVE mode.`);
                // Inspect first few orphans for sanity check
                if (orphans.length > 0) {
                    console.log("\nSample Orphans (first 5):");
                    for (const uid of orphans.slice(0, 5)) {
                        try {
                            const u = await admin.auth().getUser(uid);
                            console.log(` - ${uid} (${u.email || 'No Email'})`);
                        } catch (e) {
                            console.log(` - ${uid} (Error fetching details)`);
                        }
                    }
                }
            }
        } else {
            // DELETE MODE
            if (orphans.length === 0) {
                console.log("🎉 No orphans to delete.");
            } else {
                console.log(`🔥 DELETING ${orphans.length} ORPHANS...`);

                // Batch delete (max 1000 per batch)
                const batchSize = 1000;
                let deletedCount = 0;

                for (let i = 0; i < orphans.length; i += batchSize) {
                    const batch = orphans.slice(i, i + batchSize);
                    const deleteResult = await admin.auth().deleteUsers(batch);

                    if (deleteResult.failureCount > 0) {
                        console.error(`   ❌ Failed to delete ${deleteResult.failureCount} users in this batch.`);
                        deleteResult.errors.forEach(err => {
                            console.error(`      - ${err.error.toJSON()}`);
                        });
                    }
                    deletedCount += deleteResult.successCount;
                    console.log(`   🗑️  Deleted ${deletedCount}/${orphans.length}`);
                }
                console.log("✅ Cleanup complete.");
            }
        }

    } catch (err) {
        console.error("❌ Unexpected Error:", err);
    } finally {
        await client.end();
        process.exit(0);
    }
}

main();
