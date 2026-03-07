import { create } from 'zustand';
import { UserRole, UserProfileData, LegalRepresentative, User } from '@/types/user';

export type { UserRole };

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
    // Flattened convenient accessors
    id?: string;
    name: string;
    role: UserRole;
    email: string;
    uai?: string; // Replaces 'schoolId' as the primary link key
    schoolId?: string; // Alias for uai for backward compatibility

    // Structured Data
    profileData: UserProfileData;
    legalRepresentatives: LegalRepresentative[];

    // Metadata
    birthDate?: string; // Convenience accessor
    hasAcceptedTos: boolean | null;

    monitoringTeacher?: { id: string, name: string, email: string };
    notifications: Notification[];
    unreadCount: number;
    isLoadingProfile: boolean;

    // Actions
    setUser: (name: string, role: UserRole, email: string, uai?: string) => void;
    setRole: (role: UserRole) => void;
    addNotification: (notification: Omit<Notification, 'id' | 'read' | 'date'>) => void;
    markAsRead: (id: string) => void;
    clearNotifications: () => void;

    fetchNotifications: (userEmail: string) => Promise<void>;
    fetchUserProfile: (uid: string) => Promise<boolean>;
    createUserProfile: (uid: string, data: Partial<User> & { name?: string, schoolId?: string, birthDate?: string }) => Promise<void>;
    updateProfileData: (uid: string, data: Partial<UserProfileData>) => Promise<void>;
    updateLegalRepresentatives: (uid: string, reps: LegalRepresentative[]) => Promise<void>;
    acceptTos: (uid: string) => Promise<void>;
    trackConnection: (uid: string) => Promise<void>;
    anonymizeAccount: (uid: string) => Promise<void>;
    reset: () => void;
}

export const useUserStore = create<UserState>((set, get) => ({
    id: undefined,
    name: '',
    role: null as unknown as UserRole,
    email: '',
    uai: undefined,
    schoolId: undefined,
    profileData: {
        firstName: '',
        lastName: '',
    },
    legalRepresentatives: [],
    monitoringTeacher: undefined,
    notifications: [],
    unreadCount: 0,
    hasAcceptedTos: null,
    isLoadingProfile: false,

    setUser: (name, role, email, uai) => set({ name, role, email, uai, schoolId: uai }),
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
    // clearNotifications has been moved below as an async function.

    fetchUserProfile: async (uid: string) => {
        if (!uid || uid === 'undefined') {
            console.error("UserStore: uid is missing");
            set({ isLoadingProfile: false });
            return false;
        }

        set({ isLoadingProfile: true });

        try {
            // Add a timeout to fetch to prevent hanging forever
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

            const res = await fetch(`/api/users/${uid}`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (res.ok) {
                const { user } = await res.json();

                set({
                    id: uid,
                    name: (user.profileData?.firstName && user.profileData?.lastName)
                        ? `${user.profileData.firstName} ${user.profileData.lastName}`
                        : user.email,
                    email: user.email,
                    role: user.role,
                    uai: user.uai,
                    schoolId: user.uai,
                    birthDate: user.birthDate,
                    profileData: user.profileData || {},
                    legalRepresentatives: user.legalRepresentatives || [],
                    hasAcceptedTos: user.hasAcceptedTos,
                    isLoadingProfile: false
                });

                get().trackConnection(uid);
                return true;
            } else if (res.status === 404) {
                console.log("UserStore: User not found in Postgres.");
                set({ isLoadingProfile: false });
                return false;
            } else {
                console.error("UserStore: API Error", res.status);
                set({ isLoadingProfile: false });
                return false;
            }

        } catch (error: any) {
            console.error("UserStore: Profile Fetch Error", error);
            set({ isLoadingProfile: false });
            return false;
        }
    },

    createUserProfile: async (uid: string, data, mode = 'create') => {
        try {
            const payload = {
                uid,
                email: data.email,
                displayName: data.name,
                ...data // Pass role, etc if explicit
            };

            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error('Failed to create user');

            const { user } = await res.json();

            // Store update
            set({
                name: (user.profile_json?.firstName && user.profile_json?.lastName)
                    ? `${user.profile_json.firstName} ${user.profile_json.lastName}`
                    : user.email,
                email: user.email,
                role: user.role,
                uai: user.uai,
                schoolId: user.uai,
                profileData: user.profile_json || {},
                legalRepresentatives: user.legal_representatives || [],
                hasAcceptedTos: user.has_accepted_tos,
                isLoadingProfile: false
            });

        } catch (error) {
            console.error("Error creating user profile:", error);
            set({ isLoadingProfile: false });
            throw error;
        }
    },

    updateProfileData: async (uid: string, data) => {
        try {
            const currentProfile = get().profileData;
            const updatedProfile = { ...currentProfile, ...data };

            const res = await fetch(`/api/users/${uid}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profileData: updatedProfile })
            });

            if (!res.ok) {
                const errorData = await res.json();
                console.error("UserStore: Update failed with details:", errorData);
                throw new Error(errorData.message || 'Update failed');
            }

            set({ profileData: updatedProfile });
        } catch (error) {
            console.error("Error updating profile data:", error);
            throw error;
        }
    },

    updateLegalRepresentatives: async (uid: string, reps) => {
        try {
            const res = await fetch(`/api/users/${uid}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ legalRepresentatives: reps })
            });
            if (!res.ok) throw new Error('Update failed');

            set({ legalRepresentatives: reps });
        } catch (error) {
            console.error("Error updating legal representatives:", error);
            throw error;
        }
    },

    acceptTos: async (uid: string) => {
        try {
            const res = await fetch(`/api/users/${uid}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hasAcceptedTos: true })
            });
            if (!res.ok) throw new Error('Update failed');
            set({ hasAcceptedTos: true });
        } catch (error) {
            console.error("Error accepting TOS:", error);
            throw error;
        }
    },

    trackConnection: async (uid: string) => {
        // Optional: Could be a lightweight ping API or bundled with fetch
        // For now, we don't have a dedicated ping endpoint, but POST /api/users with existing UID touches 'last_connection'
        // Or we just skip it to reduce traffic as GET already touches nothing?
        // Actually, our POST logic for existing users performs a 'touch' update. 
        // So we can call POST lightly? Or just ignore for now as GET is frequent.
        // Let's implement lightweight touch via PUT?
        // Not critical.
    },

    anonymizeAccount: async (uid: string) => {
        // ... (Would need API endpoint support) ...
        console.warn("Anonymize not fully implemented in API yet");
        get().reset();
    },

    fetchNotifications: async (userEmail: string) => {
        if (!userEmail) return;
        try {
            const res = await fetch('/api/notifications');
            if (res.ok) {
                const notifications = await res.json();
                set({
                    notifications,
                    unreadCount: notifications.filter((n: any) => !n.read).length
                });
            }
        } catch (e) {
            console.error("Failed to fetch notifications", e);
        }
    },

    markAsRead: async (id: string) => {
        try {
            const res = await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
            if (res.ok) {
                set(state => ({
                    notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n),
                    unreadCount: Math.max(0, state.unreadCount - 1)
                }));
            }
        } catch (e) {
            console.error("Failed to mark as read", e);
        }
    },

    clearNotifications: async () => {
        try {
            const res = await fetch('/api/notifications', { method: 'DELETE' });
            if (res.ok) {
                set({ notifications: [], unreadCount: 0 });
            }
        } catch (e) {
            console.error("Failed to clear notifications", e);
        }
    },

    reset: () => set({
        name: '',
        role: null as unknown as UserRole,
        email: '',
        uai: undefined,
        schoolId: undefined,
        profileData: { firstName: '', lastName: '' },
        legalRepresentatives: [],
        notifications: [],
        unreadCount: 0,
        hasAcceptedTos: null,
        isLoadingProfile: false
    })
}));
