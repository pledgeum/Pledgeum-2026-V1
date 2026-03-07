import { create } from 'zustand';

export interface ClassDocument {
    id: string;
    name: string;
    url: string;
    classIds: string[];
    className?: string;
    uploadedBy: string;
    createdAt: string;
    type: 'RECOMMENDATION' | 'EVALUATION' | 'OTHER';
    sharedWithSchool?: boolean;
    sharedBy?: string;
    schoolName?: string;
}

interface DocumentState {
    documents: ClassDocument[];
    loading: boolean;
    error: string | null;

    fetchDocuments: (classId?: string) => Promise<void>;
    fetchUserDocuments: (userId: string, schoolName?: string) => Promise<void>;
    uploadDocument: (file: File, classIds: string[], uploadedBy: string, type?: ClassDocument['type'], sharingData?: { isShared: boolean }) => Promise<boolean>;
    toggleSharing: (docId: string, sharedWithSchool: boolean) => Promise<boolean>;
    assignDocumentToClasses: (docId: string, classIds: string[]) => Promise<boolean>;
    deleteDocument: (docId: string) => Promise<boolean>;
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
    documents: [],
    loading: false,
    error: null,

    fetchDocuments: async (classId) => {
        set({ loading: true, error: null });
        try {
            const response = await fetch('/api/documents' + (classId ? `?classId=${classId}` : ''));
            if (!response.ok) throw new Error('Failed to fetch documents');
            const data = await response.json();
            set({ documents: data, loading: false });
        } catch (error: any) {
            console.error("Error fetching documents:", error);
            set({ error: error.message, loading: false });
        }
    },

    fetchUserDocuments: async (userId, schoolName) => {
        // In PostgreSQL version, the API handles role-based filtering, so we can just call fetchDocuments()
        // or refine the API if specific user-only view is needed. 
        // For now, let's keep it simple and just fetch all allowed documents.
        set({ loading: true, error: null });
        try {
            const response = await fetch('/api/documents');
            if (!response.ok) throw new Error('Failed to fetch documents');
            const data = await response.json();
            set({ documents: data, loading: false });
        } catch (error: any) {
            console.error("Error fetching user documents:", error);
            set({ error: error.message, loading: false });
        }
    },

    uploadDocument: async (file, classIds, uploadedBy, type = 'OTHER', sharingData) => {
        set({ loading: true, error: null });
        try {
            const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = error => reject(error);
            });

            const base64Data = await toBase64(file);

            const response = await fetch('/api/documents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileName: file.name,
                    fileData: base64Data,
                    sizeBytes: file.size,
                    isShared: sharingData?.isShared,
                    classIds
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Upload failed');
            }

            // Refresh list
            await get().fetchDocuments();
            return true;
        } catch (error: any) {
            console.error("Error uploading document:", error);
            set({ error: error.message, loading: false });
            return false;
        }
    },

    toggleSharing: async (docId, sharedWithSchool) => {
        set({ loading: true, error: null });
        try {
            const response = await fetch(`/api/documents/${docId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isShared: sharedWithSchool })
            });

            if (!response.ok) throw new Error('Failed to update sharing');

            set(state => ({
                documents: state.documents.map(d => d.id === docId ? { ...d, sharedWithSchool } : d),
                loading: false
            }));
            return true;
        } catch (error: any) {
            console.error("Error toggling sharing:", error);
            set({ error: error.message, loading: false });
            return false;
        }
    },

    assignDocumentToClasses: async (docId, classIds) => {
        set({ loading: true, error: null });
        try {
            const response = await fetch(`/api/documents/${docId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ classIds })
            });

            if (!response.ok) throw new Error('Failed to update classes');

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

    deleteDocument: async (docId) => {
        set({ loading: true });
        try {
            const response = await fetch(`/api/documents/${docId}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Failed to delete document');

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
