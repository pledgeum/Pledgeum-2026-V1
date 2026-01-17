import { create } from 'zustand';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { User, UserRole, UserProfileData, LegalRepresentative } from '@/types/user';

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
    // Flattened convenient accessors (Derived from User doc)
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

    clearNotifications: () => set({ notifications: [], unreadCount: 0 }),

    fetchUserProfile: async (uid: string) => {
        console.log("UserStore: fetchUserProfile called for", uid);
        set({ isLoadingProfile: true });
        const currentUser = auth.currentUser;

        try {
            const docRef = doc(db, "users", uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data() as User;
                console.log("USER_DATA_LOADED:", data);

                // Map Firestore User to Store State
                const profile = data.profileData || { firstName: '', lastName: '' };

                // Fallback for Name if not in profile
                const displayName = (profile.firstName && profile.lastName)
                    ? `${profile.firstName} ${profile.lastName}`
                    : (data as any).name || currentUser?.displayName || '';

                // SANDBOX AUTO-REPAIR (STRICT)
                if (data.email === 'fabrice.dumasdelage@gmail.com') {
                    const needsRepair = data.uai !== '9999999X' || data.role !== 'school_head' || !data.profileData?.function;

                    if (needsRepair) {
                        console.log("Auto-repairing Sandbox User to Strict Schema...");
                        const strictProfile = {
                            firstName: data.profileData?.firstName || 'Fabrice',
                            lastName: data.profileData?.lastName || 'Dumasdelage',
                            phone: data.profileData?.phone || '0600000000',
                            function: 'Proviseur',
                            address: {
                                street: "12 Rue Ampère",
                                zipCode: "76500",
                                city: "Elbeuf"
                            }
                            // No ecole_nom
                        };

                        const updates = {
                            uai: '9999999X',
                            role: 'school_head',
                            profileData: strictProfile,
                            // Ensure schoolId alias is set too just in case
                            schoolId: '9999999X'
                        };

                        // We use updateDoc (or set merge)
                        await setDoc(docRef, updates, { merge: true });

                        // Locally update 'data' so the store gets the clean version immediately
                        data.uai = '9999999X';
                        data.role = 'school_head';
                        data.profileData = strictProfile as any;
                    }
                }

                set({
                    name: displayName,
                    email: data.email,
                    role: data.role,
                    uai: data.uai || (data as any).schoolId, // Fallback to old field if migration incomplete
                    schoolId: data.uai || (data as any).schoolId,
                    birthDate: profile.birthDate,
                    profileData: profile,
                    legalRepresentatives: data.legalRepresentatives || [],
                    hasAcceptedTos: data.hasAcceptedTos ?? false,
                    isLoadingProfile: false
                });

                return true;
            } else {
                console.log("User profile not found in Firestore.");

                // SANDBOX INITIALIZATION IF MISSING
                if (currentUser?.email === 'fabrice.dumasdelage@gmail.com') {
                    console.log("[SANDBOX] Creating Sandbox User (Strict Schema)");
                    const sandboxUser: User = {
                        uid,
                        email: 'fabrice.dumasdelage@gmail.com',
                        role: 'school_head',
                        uai: '9999999X', // The crucial link
                        createdAt: new Date().toISOString(),
                        lastConnectionAt: new Date().toISOString(),
                        hasAcceptedTos: true,
                        profileData: {
                            firstName: 'Fabrice',
                            lastName: 'Dumasdelage',
                            phone: '0600000000',
                            function: 'Proviseur', // Job Title
                            address: {
                                street: "12 Rue Ampère",
                                zipCode: "76500",
                                city: "Elbeuf"
                            }
                            // NO ecole_nom here!
                        },
                        legalRepresentatives: []
                    };
                    await setDoc(docRef, sandboxUser);
                    set({
                        name: "Fabrice Dumasdelage",
                        email: sandboxUser.email,
                        role: sandboxUser.role,
                        uai: sandboxUser.uai,
                        schoolId: sandboxUser.uai,
                        profileData: sandboxUser.profileData,
                        hasAcceptedTos: true,
                        isLoadingProfile: false
                    });
                    return true;
                }

                set({ isLoadingProfile: false, hasAcceptedTos: false });
                return false;
            }
        } catch (error) {
            console.error("Error fetching user profile:", error);
            set({ isLoadingProfile: false });
            return false;
        }
    },

    createUserProfile: async (uid: string, data) => {
        try {
            const userRef = doc(db, "users", uid);

            // Construct the strict User object
            const newUser: User = {
                uid: uid,
                email: data.email || '',
                role: data.role as UserRole,
                uai: data.uai || data.schoolId || undefined,
                createdAt: new Date().toISOString(),
                lastConnectionAt: new Date().toISOString(),
                hasAcceptedTos: false,
                profileData: {
                    firstName: (data.profileData?.firstName) || (data.name?.split(' ')[0]) || '',
                    lastName: (data.profileData?.lastName) || (data.name?.split(' ').slice(1).join(' ')) || '',
                    birthDate: data.birthDate || data.profileData?.birthDate,
                    phone: data.profileData?.phone,
                    address: data.profileData?.address,
                    class: data.profileData?.class,
                    diploma: data.profileData?.diploma,
                },
                legalRepresentatives: (data as any).legalRepresentatives || []
            };

            await setDoc(userRef, newUser, { merge: true });

            set({
                name: data.name || `${newUser.profileData.firstName} ${newUser.profileData.lastName}`,
                email: newUser.email,
                role: newUser.role,
                uai: newUser.uai,
                schoolId: newUser.uai,
                profileData: newUser.profileData,
                legalRepresentatives: newUser.legalRepresentatives,
                hasAcceptedTos: false
            });
        } catch (error) {
            console.error("Error creating user profile:", error);
            throw error;
        }
    },

    updateProfileData: async (uid: string, data) => {
        try {
            const currentProfile = get().profileData;
            const updatedProfile = { ...currentProfile, ...data };

            await updateDoc(doc(db, "users", uid), {
                profileData: updatedProfile
            });

            set({ profileData: updatedProfile });
        } catch (error) {
            console.error("Error updating profile data:", error);
            throw error;
        }
    },

    updateLegalRepresentatives: async (uid: string, reps) => {
        try {
            await updateDoc(doc(db, "users", uid), {
                legalRepresentatives: reps
            });
            set({ legalRepresentatives: reps });
        } catch (error) {
            console.error("Error updating legal representatives:", error);
            throw error;
        }
    },

    acceptTos: async (uid: string) => {
        try {
            await updateDoc(doc(db, "users", uid), { hasAcceptedTos: true });
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
            await updateDoc(doc(db, "users", uid), {
                email: `anonymized-${uid}@deleted`,
                profileData: { firstName: 'Anonyme', lastName: 'Anonyme' },
                legalRepresentatives: []
            });
            get().reset();
        } catch (error) {
            console.error("Error anonymizing:", error);
        }
    },

    fetchNotifications: async (userEmail: string) => {
        if (!userEmail) return;
        try {
            const q = query(collection(db, "notifications"), where("recipientEmail", "==", userEmail));
            const snapshot = await getDocs(q);
            const loaded: Notification[] = [];
            snapshot.forEach(d => loaded.push({ id: d.id, ...d.data() } as Notification));
            loaded.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            set({ notifications: loaded, unreadCount: loaded.filter(n => !n.read).length });
        } catch (e) { console.error(e); }
    },

    markAsRead: async (id: string) => {
        set(state => ({
            notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n),
            unreadCount: state.notifications.filter(n => !n.read && n.id !== id).length
        }));
        try {
            if (id.length > 10) await updateDoc(doc(db, "notifications", id), { read: true });
        } catch (e) { }
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
