import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type SchoolStatus = 'BETA' | 'ADHERENT';
export type FeedbackType = 'IMPROVEMENT' | 'BUG';

export interface AuthorizedSchool {
    id: string; // UAI or custom ID
    name: string;
    city: string;
    email?: string;
    status: SchoolStatus;
    authorizedAt: string;
}

export interface Feedback {
    id: string;
    schoolName: string;
    userName: string;
    userEmail: string;
    userRole: string;
    type: FeedbackType;
    message: string;
    createdAt: string;
}

interface AdminState {
    authorizedSchools: AuthorizedSchool[];
    feedbacks: Feedback[];

    authorizeSchool: (school: Omit<AuthorizedSchool, 'authorizedAt'>) => void;
    removeSchool: (id: string) => void;
    fetchAuthorizedSchools: () => Promise<void>; // NEW: Fetch from Firestore

    addFeedback: (feedback: Omit<Feedback, 'id' | 'createdAt'>) => void;

    isSchoolAuthorized: (name: string) => boolean;
}

export const useAdminStore = create<AdminState>()(
    persist(
        (set, get) => ({
            authorizedSchools: [],
            feedbacks: [],

            authorizeSchool: (school) => set((state) => {
                if (state.authorizedSchools.some(s => s.id === school.id)) return state;
                return {
                    authorizedSchools: [...state.authorizedSchools, { ...school, authorizedAt: new Date().toISOString() }]
                };
            }),

            removeSchool: (id) => set((state) => ({
                authorizedSchools: state.authorizedSchools.filter(s => s.id !== id)
            })),

            fetchAuthorizedSchools: async () => {
                try {
                    console.log("[AdminStore] Fetching authorized schools from Firestore...");
                    const q = query(collection(db, "schools"), where("isAuthorized", "==", true));
                    const snapshot = await getDocs(q);

                    const fetchedSchools: AuthorizedSchool[] = [];
                    snapshot.forEach(doc => {
                        const data = doc.data();
                        fetchedSchools.push({
                            id: doc.id,
                            name: data.schoolName,
                            city: data.schoolCity,
                            email: data.schoolHeadEmail,
                            status: (data.schoolStatus as SchoolStatus) || 'ADHERENT', // Use persisted status
                            authorizedAt: data.updatedAt || new Date().toISOString()
                        });
                    });

                    // Merge with existing logic if needed, or overwrite? 
                    // Overwrite is safer to sync with source of truth
                    set({ authorizedSchools: fetchedSchools });
                    console.log(`[AdminStore] Loaded ${fetchedSchools.length} schools.`);
                } catch (e) {
                    console.error("[AdminStore] Error fetching schools:", e);
                }
            },

            addFeedback: (feedback) => set((state) => ({
                feedbacks: [
                    { ...feedback, id: Math.random().toString(36).substr(2, 9), createdAt: new Date().toISOString() },
                    ...state.feedbacks
                ]
            })),

            isSchoolAuthorized: (name) => {
                const schools = get().authorizedSchools;
                if (!name) return false;
                // Simple case-insensitive exact match or partial match
                return schools.some(s =>
                    s.name.toLowerCase().includes(name.toLowerCase()) ||
                    name.toLowerCase().includes(s.name.toLowerCase())
                );
            }
        }),
        {
            name: 'admin-storage',
        }
    )
);
