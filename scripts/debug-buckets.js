const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// 1. Manually load .env.local since we are running a standalone script
console.log("Loading .env.local...");
try {
    const envPath = path.resolve(__dirname, '../.env.local');
    if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, 'utf8');
        envConfig.split('\n').forEach(line => {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('#')) return;

            const separatorIndex = trimmedLine.indexOf('=');
            if (separatorIndex > 0) {
                const key = trimmedLine.substring(0, separatorIndex).trim();
                let val = trimmedLine.substring(separatorIndex + 1).trim();

                // Remove surrounding quotes if present
                if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                    val = val.slice(1, -1);
                }

                // Handle newlines in value (e.g. private key in quotes) relies on single line here, 
                // but .env often has private key in one line with \n chars.
                // We will rely on the replacement logic later.

                process.env[key] = val;
            }
        });
        console.log("Loaded .env.local");
    } else {
        console.error("No .env.local found at", envPath);
    }
} catch (e) {
    console.error("Error reading .env.local:", e);
}

// 2. Initialize Firebase Admin
try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
        console.error("Missing credentials:");
        console.error("Project ID:", projectId ? "Set" : "Missing");
        console.error("Client Email:", clientEmail ? "Set" : "Missing");
        console.error("Private Key:", privateKey ? "Set" : "Missing");
        process.exit(1);
    }

    console.log(`Initializing Firebase for project: ${projectId}`);

    admin.initializeApp({
        credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
    });

    console.log("Firebase Admin initialized.");

} catch (error) {
    console.error("Initialization Failed:", error);
    process.exit(1);
}

// 3. Check Buckets
async function checkBuckets() {
    const bucketNames = [
        'pledgeum-2025-antigravity.appspot.com',
        'pledgeum-2025-antigravity.firebasestorage.app',
        'pledgeum-2025-antigravity',
        process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    ].filter(Boolean);

    // Deduplicate
    const uniqueNames = [...new Set(bucketNames)];

    console.log(`Checking existence of ${uniqueNames.length} potential buckets...`);

    for (const name of uniqueNames) {
        try {
            console.log(`\nChecking bucket: '${name}'...`);
            const bucket = admin.storage().bucket(name);
            const [exists] = await bucket.exists();
            if (exists) {
                console.log(`✅ Bucket '${name}' EXISTS and is accessible.`);
                // Get memory
                const [metadata] = await bucket.getMetadata();
                console.log(`   Location: ${metadata.location}`);
            } else {
                console.log(`❌ Bucket '${name}' does NOT exist (or 403 Forbidden).`);
            }
        } catch (error) {
            console.log(`❌ Error checking '${name}': ${error.message}`);
        }
    }
}

checkBuckets();
