
'use client';

import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

export default function ForcePasswordChangeGuard({ children }: { children: React.ReactNode }) {
    const { data: session, status } = useSession();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (status === 'loading') return;

        // Condition: User valid, flag is true, but NOT on the update page
        if (
            session?.user &&
            (session.user as any).must_change_password &&
            pathname !== '/auth/update-password'
        ) {
            console.log("Forcing password change redirection...");
            router.push('/auth/update-password');
        }
    }, [session, status, pathname, router]);

    // Render children normally. The effect will redirect if needed.
    // We don't block rendering to avoid strict flickering, but content might flash briefly.
    // For stricter blocking, we could return null if check fails, but 'loading' status covers most initial load.
    return <>{children}</>;
}
