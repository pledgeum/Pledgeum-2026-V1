'use client';

import { useEffect, useState, useRef } from 'react';
import { useSession } from "next-auth/react";
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

// List of roles that do NOT need a UAI attached to their profile
const rolesExemptFromUai = ['parent', 'tutor', 'company_head', 'company_admin', 'company_head_tutor', 'admin', 'SUPER_ADMIN'];

export function ProfileGuard({ children }: { children: React.ReactNode }) {
    const { data: session, status } = useSession();
    const loading = status === "loading";
    const user = session?.user;

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
            if (loading) return;

            if (!user) {
                setIsChecking(false);
                return;
            }

            // BYPASS FOR SUPER ADMIN / TEST ACCOUNT
            if (user.email === 'pledgeum@gmail.com') {
                setIsChecking(false);
                return;
            }

            // Check for password change requirement immediately
            if ((user as any).must_change_password) {
                if (pathname === '/auth/update-password') {
                    // Safety Brake: Already there, allow render
                    setIsChecking(false);
                    return;
                }
                router.push('/auth/update-password');
                return;
            }

            // User is logged in. 
            // Always ensure profile is loaded and matches current user
            const storeId = useUserStore.getState().id;
            const storeUai = useUserStore.getState().uai;

            if (loadError) return; // Stop checking if we already failed

            // Force fetch if:
            // 1. Not attempted yet
            // 2. Store is empty
            // 3. Store ID doesn't match Session ID (User switched account)
            // 4. UAI is missing (Vital for app function)

            const needsFetch = !fetchAttempted.current ||
                (profileData && Object.keys(profileData).length === 0) ||
                (storeId !== user.id) ||
                (!storeUai && !isLoadingProfile && !rolesExemptFromUai.includes(user.role as any));

            if (needsFetch && !isLoadingProfile) {
                console.log("[ProfileGuard] Fetching profile. Reason: ", { attempted: fetchAttempted.current, storeId, sessionId: user.id, hasUai: !!storeUai });
                fetchAttempted.current = true;

                // Add a local timeout as an ultimate safety net for the fetch
                const fetchTimeout = setTimeout(() => {
                    if (isLoadingProfile) { // Check if it's still loading after timeout
                        console.error("ProfileGuard: Profile fetch timed out (UI Fallback)");
                        setLoadError(true); // Set error to display fallback UI
                    }
                }, 15000); // 15 seconds timeout

                const success = await fetchUserProfile(user.id || '');
                clearTimeout(fetchTimeout); // Clear timeout if fetch completes

                if (!success) {
                    setLoadError(true);
                }
                return;
            }

            if (isLoadingProfile) {
                console.log("ProfileGuard: Waiting for profile load...");
                return;
            }




            // Check exclusions AFTER data is potentially loaded
            const isExcluded = EXCLUDED_PATHS.some(p => pathname?.startsWith(p));
            if (isExcluded) {
                console.log("ProfileGuard: Path excluded", pathname);
                setIsChecking(false);
                return;
            }

            // Profile loaded. Now check completeness.

            // Enforce UAI for non-exempt roles (Students, Teachers, Admins)
            // If they don't have a UAI, they shouldn't be here (unless excluded path)
            if (!storeUai && !rolesExemptFromUai.includes(user.role as any)) {
                const target = '/onboarding/establishment';
                if (pathname !== target && !pathname?.startsWith('/onboarding')) {
                    console.log("ProfileGuard: Redirecting to establishment onboarding due to missing UAI");
                    router.push(target);
                    return;
                }
            }

            if (!isComplete) {
                // DISABLED PERMANENTLY: Stop forcing redirection to complete-profile
                // router.push('/complete-profile');
            } else {
                setIsChecking(false);
            }
        };

        checkStatus();
    }, [user, loading, isComplete, isLoadingProfile, pathname, router, fetchUserProfile, profileData]);


    if (loading || (user && isLoadingProfile && !EXCLUDED_PATHS.some(p => pathname?.startsWith(p)))) {
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
