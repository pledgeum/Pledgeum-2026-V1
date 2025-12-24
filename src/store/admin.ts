import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
