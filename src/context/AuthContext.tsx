'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    logout: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setUser(user);
            setLoading(false);
            if (user) {
                // Ensure profile is loaded immediately
                const { useUserStore } = await import('@/store/user');
                useUserStore.getState().fetchUserProfile(user.uid);
            }
        });

        return () => unsubscribe();
    }, []);

    const logout = async () => {
        try {
            await firebaseSignOut(auth);
            // Dynamic import or direct access if easier, assuming context usage
            // But since we are in context, we can't easily use hooks. 
            // Better to clean up via store directly if imported.
            const { useUserStore } = await import('@/store/user');
            useUserStore.getState().reset();

            const { useSchoolStore } = await import('@/store/school');
            useSchoolStore.getState().reset();

            const { useConventionStore } = await import('@/store/convention');
            useConventionStore.getState().reset();

            const { useDemoStore } = await import('@/store/demo');
            useDemoStore.getState().reset();
        } catch (error) {
            console.error("Logout error:", error);
            // Even if firebase fails (network?), we should clear local state & redirect
        } finally {
            router.push('/login');
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, logout }}>
            {children}
        </AuthContext.Provider>
    );
}
