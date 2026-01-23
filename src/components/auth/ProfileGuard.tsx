'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useProfileStatus } from '@/hooks/useProfileStatus';
import { useRouter, usePathname } from 'next/navigation';
import { useUserStore } from '@/store/user';

const EXCLUDED_PATHS = [
    '/login',
    '/signup',
    '/verify',
    '/complete-profile',
    '/onboarding',
    '/api',
    '/auth', // Exclude auth routes (like update-password) from global profile guard
    '/_next',
    '/favicon.ico'
];

export function ProfileGuard({ children }: { children: React.ReactNode }) {
    const { user, loading: authLoading } = useAuth();
    const { isComplete } = useProfileStatus();
    const { isLoadingProfile, fetchUserProfile, profileData } = useUserStore();
    const router = useRouter();
    const pathname = usePathname();
    const [isChecking, setIsChecking] = useState(true);
    const [loadError, setLoadError] = useState(false);

    // Safety check to prevent infinite fetch loops
    const fetchAttempted = useRef(false);

    useEffect(() => {
        const checkStatus = async () => {
            if (authLoading) return; // Wait for Firebase Auth

            if (!user) {
                // Not logged in.
                // We don't necessarily redirect here because the page content might be public or handle its own redirect.
                // But generally, the dashboard handles it.
                // For the guard, we just stop checking.
                setIsChecking(false);
                return;
            }

            // User is logged in. 
            // Always ensure profile is loaded, even if on excluded path (like /complete-profile)
            if (!fetchAttempted.current && Object.keys(profileData || {}).length === 0 && !isLoadingProfile) {
                fetchAttempted.current = true;
                const success = await fetchUserProfile(user.uid);
                if (!success) {
                    setLoadError(true);
                }
                return;
            }

            if (isLoadingProfile) {
                console.log("ProfileGuard: Waiting for profile load...");
                return;
            }

            if (loadError) return; // Stop checking if error

            // Check exclusions AFTER data is potentially loaded
            const isExcluded = EXCLUDED_PATHS.some(p => pathname?.startsWith(p));
            if (isExcluded) {
                console.log("ProfileGuard: Path excluded", pathname);
                setIsChecking(false);
                return;
            }

            // Profile loaded. Now check completeness.
            if (!isComplete) {
                // DISABLED PERMANENTLY: Stop forcing redirection to complete-profile
                // router.push('/complete-profile');
            } else {
                setIsChecking(false);
            }
        };

        checkStatus();
    }, [user, authLoading, isComplete, isLoadingProfile, pathname, router, fetchUserProfile, profileData]);


    if (authLoading || (user && isLoadingProfile && !EXCLUDED_PATHS.some(p => pathname?.startsWith(p)))) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-500">Chargement de votre profil...</p>
                </div>
            </div>
        );
    }

    // Hide content if we are about to redirect (isChecking is true and we found an issue)
    // But we need to be careful not to block valid content if logic falls through.
    // If checking is done (setIsChecking(false)), we render.
    // Or if likely valid.

    // Simplification: If user && !isComplete && !excluded => return null (redirecting)
    // ALLOW INCOMPLETE PROFILES TO RENDER
    // We rely on ProfileModal or headers to nudge user to complete profile.

    if (loadError) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center max-w-md p-6 bg-white rounded-lg shadow-md border border-red-200">
                    <h2 className="text-xl font-bold text-red-600 mb-2">Service Indisponible</h2>
                    <p className="text-gray-600 mb-4">Impossible de charger votre profil utilisateur. Une erreur technique est survenue.</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                    >
                        Réessayer
                    </button>
                    <div className="mt-4 text-xs text-gray-400">
                        Si le problème persiste, le service de base de données est peut-être inaccessible via l'API. (Erreur 500)
                    </div>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
