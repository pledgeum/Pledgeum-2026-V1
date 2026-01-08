import admin from 'firebase-admin';

let auth: admin.auth.Auth;
let db: admin.firestore.Firestore;
let initError: any;

if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId) console.error("❌ FIREBASE_PROJECT_ID is missing");
    if (!clientEmail) console.error("❌ FIREBASE_CLIENT_EMAIL is missing");
    if (!privateKey) console.error("❌ FIREBASE_PRIVATE_KEY is missing");
    else if (!privateKey.includes("BEGIN PRIVATE KEY")) console.error("❌ FIREBASE_PRIVATE_KEY seems invalid (missing header)");

    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                clientEmail,
                // Handle newline characters in private key if present
                privateKey: privateKey
                    ? privateKey.replace(/\\n/g, '\n')
                    : undefined,
            }),
            storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.replace('gs://', ''),
        });
        console.log('[Firebase Admin] Initialized successfully with bucket:', process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.replace('gs://', ''));
    } catch (error) {
        initError = error;
        console.error('[Firebase Admin] Initialization error:', error);
    }
}

try {
    if (admin.apps.length) {
        auth = admin.auth();
        db = admin.firestore();
        // storage handled via admin.storage().bucket() usually, but let's export the service
    }
} catch (e) {
    console.error("Failed to get Admin services:", e);
    initError = initError || e;
}

// Export authentic instances or mocks that throw on use (preventing module-level crash)
export const adminAuth = auth! || {
    verifyIdToken: async () => { throw new Error(`Firebase Admin Auth not initialized. Root Error: ${initError?.message || initError}`); },
    getUser: async () => { throw new Error(`Firebase Admin Auth not initialized. Root Error: ${initError?.message || initError}`); }
} as any;

export const adminDb = db! || {
    collection: () => { throw new Error(`Firebase Admin Firestore not initialized. Root Error: ${initError?.message || initError}`); },
    batch: () => { throw new Error(`Firebase Admin Firestore not initialized. Root Error: ${initError?.message || initError}`); }
} as any;

export const adminFirestore = adminDb;

export const adminStorage = admin.storage ? admin.storage() : {
    bucket: () => { throw new Error(`Firebase Admin Storage not initialized. Root Error: ${initError?.message || initError}`); }
} as any;
