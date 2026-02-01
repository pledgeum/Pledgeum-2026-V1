// Mock Firebase functionality to prevent build errors during migration
// This file should eventually be removed once all references are migrated to Postgres/NextAuth

export const auth = {
    currentUser: null,
    signOut: async () => { console.log("Mock signOut called"); },
    onAuthStateChanged: (cb: any) => { return () => { }; },
    signInWithEmailAndPassword: async () => { throw new Error("Firebase Auth is disabled"); },
    createUserWithEmailAndPassword: async () => { throw new Error("Firebase Auth is disabled"); },
} as any;

export const db = {
    collection: () => ({ withConverter: () => { } }),
} as any;

export const storage = {} as any;

// Mock Firestore functions if imported directly from this file (though usually from firebase/firestore)
export const doc = (...args: any[]) => {
    if (args.length === 3) return { id: args[2], path: `${args[1]}/${args[2]}` };
    if (args.length === 2) return { id: args[1].split('/').pop(), path: args[1] }; // db, path
    if (args.length === 1) return { id: 'mock-auto-id', path: (args[0].path || 'mock') + '/mock-auto-id' }; // collectionRef
    return { id: 'mock', path: 'mock' };
};
export const collection = (db: any, path: string) => ({ path, withConverter: () => { } });
export const addDoc = async (ref: any, data: any) => ({ id: 'mock-id', ...data });
export const updateDoc = async (ref: any, data: any) => { };
export const setDoc = async (ref: any, data: any, options?: any) => { };
export const getDoc = async (ref: any) => ({ id: ref.id, exists: () => false, data: () => ({}) });
export const getDocs = async (query: any) => ({ docs: [] as any[], forEach: (cb: any) => { } });
export const deleteDoc = async (ref: any) => { };
export const query = (...args: any[]) => ({});
export const where = (field: string, op: string, value: any) => ({});
export const orderBy = (field: string, dir?: string) => ({});
export const limit = (n: number) => ({});
export const serverTimestamp = () => new Date().toISOString();
export const onSnapshot = (query: any, cb: any) => () => { };
export const arrayUnion = (...args: any[]) => args;
export const arrayRemove = (...args: any[]) => args;
export const writeBatch = (db: any) => ({
    set: (ref: any, data: any, options?: any) => { },
    update: (ref: any, data: any) => { },
    delete: (ref: any) => { },
    commit: async () => { }
});

// Mock Storage
export const ref = (storage: any, path: string) => ({ fullPath: path });
export const uploadBytes = async (ref: any, file: any) => ({ ref });
export const getDownloadURL = async (ref: any) => "https://mock-storage.com/file";
export const deleteObject = async (ref: any) => { };

// Mock Auth Additional
export const updatePassword = async (user: any, pass: string) => { };
export const signInWithCustomToken = async (auth: any, token: string) => ({ user: { uid: 'mock-uid', email: 'mock@example.com' } });
export const sendPasswordResetEmail = async (auth: any, email: string) => { };
export const GoogleAuthProvider = class { };
export const signInWithPopup = async () => { };

