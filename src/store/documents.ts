import { create } from 'zustand';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, orderBy, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

export interface ClassDocument {
    id: string;
    name: string;
    url: string;
    classIds: string[]; // List of class IDs this doc is assigned to
    className?: string; // For display convenience if needed (e.g. "T.ASSP 1") or logic
    uploadedBy: string; // User ID
    createdAt: string; // ISO String
    type: 'RECOMMENDATION' | 'EVALUATION' | 'OTHER';
}

interface DocumentState {
    documents: ClassDocument[];
    loading: boolean;
    error: string | null;

    fetchDocuments: (classId?: string) => Promise<void>;
    fetchUserDocuments: (userId: string) => Promise<void>;
    uploadDocument: (file: File, classIds: string[], uploadedBy: string, type?: ClassDocument['type']) => Promise<boolean>;
    assignDocumentToClasses: (docId: string, classIds: string[]) => Promise<boolean>;
    deleteDocument: (docId: string, fileUrl: string) => Promise<boolean>;
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
    documents: [],
    loading: false,
    error: null,

    fetchDocuments: async (classId) => {
        set({ loading: true, error: null });
        try {
            let q;
            const docsRef = collection(db, 'class_documents');

            if (classId) {
                // If specific class requested (e.g. Student view)
                q = query(docsRef, where('classIds', 'array-contains', classId));
            } else {
                // Fetch all (e.g. Admin/Teacher view - might want to filter by their classes later)
                // For now, fetching all to let UI filter or separate by user permissions
                q = query(docsRef);
            }

            const snapshot = await getDocs(q);
            const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ClassDocument));

            // Sort by createdAt desc locally since Firestore index for array-contains + sort might be missing
            docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            set({ documents: docs, loading: false });
        } catch (error: any) {
            console.error("Error fetching documents:", error);
            set({ error: error.message, loading: false });
        }
    },

    uploadDocument: async (file, classIds, uploadedBy, type = 'OTHER') => {
        if (!storage) {
            set({ error: "Storage not configured" });
            return false;
        }

        set({ loading: true, error: null });
        try {
            // 1. Upload to Storage
            const storageRef = ref(storage, `class_documents/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const url = await getDownloadURL(snapshot.ref);

            // 2. Save metadata to Firestore
            const docData: Omit<ClassDocument, 'id'> = {
                name: file.name,
                url,
                classIds,
                uploadedBy,
                createdAt: new Date().toISOString(),
                type
            };

            const docRef = await addDoc(collection(db, 'class_documents'), docData);

            // 3. Update local state
            const newDoc = { id: docRef.id, ...docData };
            set(state => ({
                documents: [newDoc, ...state.documents],
                loading: false
            }));

            return true;
        } catch (error: any) {
            console.error("Error uploading document:", error);
            set({ error: error.message, loading: false });
            return false;
        }
    },

    assignDocumentToClasses: async (docId, classIds) => {
        set({ loading: true, error: null });
        try {
            const docRef = doc(db, 'class_documents', docId);
            await updateDoc(docRef, { classIds });

            set(state => ({
                documents: state.documents.map(d => d.id === docId ? { ...d, classIds } : d),
                loading: false
            }));
            return true;
        } catch (error: any) {
            console.error("Error updates classes:", error);
            set({ error: error.message, loading: false });
            return false;
        }
    },

    fetchUserDocuments: async (userId) => {
        set({ loading: true, error: null });
        try {
            const docsRef = collection(db, 'class_documents');
            const q = query(docsRef, where('uploadedBy', '==', userId)); // Index might be needed

            const snapshot = await getDocs(q);
            const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ClassDocument));

            // Sort
            docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            // We might want to separate "My Docs" from "Class Docs" in state, or just use `documents` and let component filter?
            // The Plan implies a separate view. If we overwrite `documents`, the "Active Documents" list in the modal might switch context.
            // But the modal seems to want to switch TABS.
            // If I overwrite `documents`, the "List Section" in the modal (which currently shows filtered docs) will show these.
            // Let's stick to using the main `documents` array for simplicity, as the component will govern what to show.

            set({ documents: docs, loading: false });
        } catch (error: any) {
            console.error("Error fetching user documents:", error);
            set({ error: error.message, loading: false });
        }
    },

    deleteDocument: async (docId, fileUrl) => {
        if (!storage) return false;
        set({ loading: true });
        try {
            // 1. Delete from Storage
            // Extract path from URL or pass path directly. Simplest is creating ref from URL.
            const fileRef = ref(storage, fileUrl);
            await deleteObject(fileRef).catch(err => console.warn("Storage deletion failed (might be already gone):", err));

            // 2. Delete from Firestore
            await deleteDoc(doc(db, 'class_documents', docId));

            // 3. Update locally
            set(state => ({
                documents: state.documents.filter(d => d.id !== docId),
                loading: false
            }));
            return true;
        } catch (error: any) {
            console.error("Error deleting document:", error);
            set({ error: error.message, loading: false });
            return false;
        }
    }
}));
