import { create } from 'zustand';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export type UserRole = 'student' | 'teacher' | 'teacher_tracker' | 'school_head' | 'company_head' | 'tutor' | 'parent' | 'company_head_tutor' | 'ddfpt' | 'business_manager' | 'assistant_manager' | 'stewardship_secretary';

export interface Notification {
    id: string;
    title: string;
    message: string;
    actionLabel?: string;
    actionLink?: string;
    read: boolean;
    date: string;
}

interface UserState {
    name: string;
    role: UserRole;
    email: string;
    birthDate?: string; // NEW
    profileData: Record<string, any>; // NEW
    monitoringTeacher?: { id: string, name: string, email: string }; // For students
    notifications: Notification[];
    unreadCount: number;
    hasAcceptedTos: boolean; // NEW
    setUser: (name: string, role: UserRole, email: string) => void;
    setRole: (role: UserRole) => void;
    addNotification: (notification: Omit<Notification, 'id' | 'read' | 'date'>) => void;
    markAsRead: (id: string) => void;
    clearNotifications: () => void;
    fetchUserProfile: (uid: string) => Promise<boolean>;
    createUserProfile: (uid: string, data: { email: string, role: UserRole, name: string, birthDate?: string }) => Promise<void>;
    updateProfileData: (uid: string, data: Record<string, any>) => Promise<void>;
    acceptTos: (uid: string) => Promise<void>;
    trackConnection: (uid: string) => Promise<void>;
    anonymizeAccount: (uid: string) => Promise<void>;
}

export const useUserStore = create<UserState>((set, get) => ({
    name: 'Thomas Dubois',
    role: 'student',
    email: 'thomas.dubois@email.com',
    profileData: {}, // NEW
    monitoringTeacher: undefined,
    notifications: [],
    unreadCount: 0,
    hasAcceptedTos: false,
    setUser: (name, role, email) => set({ name, role, email }),
    setRole: (role) => set({ role }),
    addNotification: (notif) => set((state) => {
        const newNotif: Notification = {
            ...notif,
            id: Math.random().toString(36).substr(2, 9),
            read: false,
            date: new Date().toISOString()
        };
        return {
            notifications: [newNotif, ...state.notifications],
            unreadCount: state.unreadCount + 1
        };
    }),
    markAsRead: (id) => set((state) => {
        const newNotifs = state.notifications.map(n => n.id === id ? { ...n, read: true } : n);
        return {
            notifications: newNotifs,
            unreadCount: newNotifs.filter(n => !n.read).length
        };
    }),
    clearNotifications: () => set({ notifications: [], unreadCount: 0 }),

    fetchUserProfile: async (uid: string) => {
        try {
            const docRef = doc(db, "users", uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                set({
                    name: data.name || '',
                    email: data.email || '',
                    role: data.role as UserRole,
                    birthDate: data.birthDate,
                    profileData: data.profileData || {},
                    hasAcceptedTos: data.hasAcceptedTos || false
                });
                return true;
            }
            return false;
        } catch (error) {
            console.error("Error fetching user profile:", error);
            return false;
        }
    },

    createUserProfile: async (uid: string, data) => {
        try {
            const userRef = doc(db, "users", uid);
            const userSnap = await getDoc(userRef);
            const existingData = userSnap.exists() ? userSnap.data() : {};
            const existingProfileData = existingData.profileData || {};

            const finalData = {
                ...existingData,
                ...data,
                birthDate: data.birthDate || existingData.birthDate || null,
                profileData: existingProfileData, // Preserve existing profile data
                createdAt: existingData.createdAt || new Date().toISOString(),
                lastConnectionAt: new Date().toISOString(), // Track creation as connection
                hasAcceptedTos: false // Default to false on creation
            };

            await setDoc(userRef, finalData);

            set({
                name: data.name,
                email: data.email,
                role: data.role,
                birthDate: finalData.birthDate,
                profileData: finalData.profileData,
                hasAcceptedTos: false
            });
        } catch (error) {
            console.error("Error creating user profile:", error);
            throw error;
        }
    },

    updateProfileData: async (uid: string, data: Record<string, any>) => {
        try {
            // Safe merge: Get current data from store to avoid overwriting missing fields
            const currentProfile = get().profileData || {};
            const mergedProfileData = { ...currentProfile, ...data };

            const updates: Record<string, any> = { profileData: mergedProfileData };

            // Sync top-level fields if present in the update
            if (data.birthDate) {
                updates.birthDate = data.birthDate;
            }
            if (data.email) {
                updates.email = data.email;
            }

            await setDoc(doc(db, "users", uid), updates, { merge: true });

            set((state) => ({
                birthDate: data.birthDate || state.birthDate,
                email: data.email || state.email,
                profileData: mergedProfileData
            }));
        } catch (error) {
            console.error("Error updating profile data:", error);
            throw error;
        }
    },

    acceptTos: async (uid: string) => {
        try {
            const userRef = doc(db, "users", uid);
            await setDoc(userRef, { hasAcceptedTos: true, tosAcceptedAt: new Date().toISOString() }, { merge: true });
            set({ hasAcceptedTos: true });
        } catch (error) {
            console.error("Error accepting TOS:", error);
            throw error;
        }
    },

    trackConnection: async (uid: string) => {
        try {
            await setDoc(doc(db, "users", uid), { lastConnectionAt: new Date().toISOString() }, { merge: true });
        } catch (error) {
            console.error("Error tracking connection:", error);
        }
    },

    anonymizeAccount: async (uid: string) => {
        try {
            const randomId = Math.random().toString(36).substr(2, 6);
            const anonymizedData = {
                name: `Anonyme ${randomId}`,
                email: `anonymized-${randomId}@pledgeum.deleted`,
                birthDate: null,
                profileData: {}, // Clear all profile details
                hasAcceptedTos: false,
                isAnonymized: true,
                anonymizedAt: new Date().toISOString()
            };

            await setDoc(doc(db, "users", uid), anonymizedData, { merge: true });

            set({
                name: anonymizedData.name,
                email: anonymizedData.email,
                profileData: {},
                birthDate: undefined
            });
        } catch (error) {
            console.error("Error anonymizing account:", error);
            throw error;
        }
    }
}));
