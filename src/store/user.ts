import { create } from 'zustand';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export type UserRole = 'student' | 'teacher' | 'teacher_tracker' | 'school_head' | 'company_head' | 'tutor' | 'parent' | 'company_head_tutor' | 'ddfpt' | 'business_manager' | 'assistant_manager' | 'stewardship_secretary' | 'at_ddfpt';

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
    hasAcceptedTos: boolean | null; // (null = loading/unknown)
    isLoadingProfile: boolean; // Syncs with fetchUserProfile
    setUser: (name: string, role: UserRole, email: string) => void;
    setRole: (role: UserRole) => void;
    addNotification: (notification: Omit<Notification, 'id' | 'read' | 'date'>) => void;
    markAsRead: (id: string) => void;
    clearNotifications: () => void;
    fetchNotifications: (userEmail: string) => Promise<void>;
    fetchUserProfile: (uid: string) => Promise<boolean>;
    createUserProfile: (uid: string, data: { email: string, role: UserRole, name: string, birthDate?: string, profileData?: Record<string, any> }) => Promise<void>;
    updateProfileData: (uid: string, data: Record<string, any>) => Promise<void>;
    acceptTos: (uid: string) => Promise<void>;
    trackConnection: (uid: string) => Promise<void>;
    anonymizeAccount: (uid: string) => Promise<void>;
    reset: () => void;
}

export const useUserStore = create<UserState>((set, get) => ({
    name: 'Thomas Dubois',
    role: 'student',
    email: 'thomas.dubois@email.com',
    profileData: {}, // NEW
    monitoringTeacher: undefined,
    notifications: [],
    unreadCount: 0,
    hasAcceptedTos: null,
    isLoadingProfile: false,
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
    clearNotifications: () => set({ notifications: [], unreadCount: 0 }),

    fetchUserProfile: async (uid: string) => {
        set({ isLoadingProfile: true });
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
                    hasAcceptedTos: data.hasAcceptedTos || false,
                    isLoadingProfile: false
                });
                return true;
            }
            set({
                isLoadingProfile: false,
                hasAcceptedTos: false
            });
            return false;
        } catch (error) {
            console.error("Error fetching user profile:", error);
            set({ isLoadingProfile: false });
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
                profileData: { ...existingProfileData, ...(data.profileData || {}) }, // Merge existing with new
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
    },

    fetchNotifications: async (userEmail: string) => {
        if (!userEmail) return;
        // Import dynamically to avoid circular dependencies if any, but standard import is fine here
        const { collection, query, where, getDocs, updateDoc, doc, orderBy } = await import('firebase/firestore');

        try {
            let q;
            if (userEmail === 'pledgeum@gmail.com') {
                // Super Admin / Test Account: Fetch ALL recent notifications to monitor system
                q = query(
                    collection(db, "notifications"),
                    orderBy("date", "desc")
                    // limit(50) // Optional limit
                );
            } else {
                q = query(
                    collection(db, "notifications"),
                    where("recipientEmail", "==", userEmail)
                );
            }

            const snapshot = await getDocs(q);
            const loadedNotifs: Notification[] = [];

            snapshot.forEach(doc => {
                const data = doc.data();
                // For Super Admin, maybe prepend recipient to title?
                const titlePrefix = (userEmail === 'pledgeum@gmail.com' && data.recipientEmail)
                    ? `[${data.recipientEmail}] `
                    : '';

                loadedNotifs.push({
                    id: doc.id,
                    title: titlePrefix + data.title,
                    message: data.message,
                    read: data.read,
                    date: data.date,
                    actionLabel: data.actionLabel,
                    actionLink: data.actionLink
                });
            });

            // Sort manually desc (redundant if using orderBy, but safe)
            loadedNotifs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            set({
                notifications: loadedNotifs,
                unreadCount: loadedNotifs.filter(n => !n.read).length
            });
            console.log(`[STORE] Fetched ${loadedNotifs.length} notifications for ${userEmail}`);
        } catch (error) {
            console.error("Error fetching notifications:", error);
        }
    },

    // Override markAsRead to persist to DB
    markAsRead: async (id: string) => {
        // Optimistic update
        set((state) => {
            const newNotifs = state.notifications.map(n => n.id === id ? { ...n, read: true } : n);
            return {
                notifications: newNotifs,
                unreadCount: newNotifs.filter(n => !n.read).length
            };
        });

        // DB update
        try {
            const { updateDoc, doc } = await import('firebase/firestore');
            // We assume ID is the DB doc ID. For local notifs (random ID), this will fail silently/catch.
            // Check if ID is likely a DB ID (usually 20 chars) vs random (variable)
            if (id.length > 10) {
                await updateDoc(doc(db, "notifications", id), { read: true });
            }
        } catch (e) {
            console.warn("Could not mark as read in DB (likely local notification)", e);
        }
    },

    reset: () => set({
        name: '',
        role: 'student', // Default or null? Student is safer for type
        email: '',
        profileData: {},
        notifications: [],
        unreadCount: 0,
        hasAcceptedTos: null,
        isLoadingProfile: false,
        monitoringTeacher: undefined
    })
}));
