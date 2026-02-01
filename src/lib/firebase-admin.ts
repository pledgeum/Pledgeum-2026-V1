// Mock Firebase Admin functionality to prevent build errors during migration

export const adminAuth = {
    getUser: async () => null,
    getUserByEmail: async () => null,
    createUser: async () => null,
    setCustomUserClaims: async () => null,
} as any;

export const adminDb = {
    collection: () => ({ doc: () => ({ get: async () => ({ exists: false }), set: async () => { } }) }),
} as any;

export const adminFirestore = adminDb;

export const adminStorage = {
    bucket: () => ({ file: () => ({ save: async () => { } }) }),
} as any;
