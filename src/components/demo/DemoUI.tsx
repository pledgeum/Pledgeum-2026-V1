"use client";

import { useEffect, useState, useRef } from "react";
import { useDemoStore } from "@/store/demo";
import { useSchoolStore } from "@/store/school";
import { useUserStore } from "@/store/user";
import { EmailSimulatorModal } from "./EmailSimulatorModal";
import { MockMailbox } from "./MockMailbox";
import { GripVertical } from "lucide-react";
import { usePathname, useRouter } from 'next/navigation';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function DemoUI() {
    const isDemoMode = useDemoStore((state) => state.isDemoMode);
    const demoRole = useDemoStore((state) => state.demoRole);
    const restoreTestData = useSchoolStore((state) => state.restoreTestData);
    const email = useUserStore((state) => state.email);

    // Contextual Notification State
    const [pendingRoleNotification, setPendingRoleNotification] = useState<string | null>(null);

    // Drag Logic
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const isDragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const startPos = useRef({ x: 0, y: 0 });

    const handleStart = (clientX: number, clientY: number) => {
        isDragging.current = true;
        dragStart.current = { x: clientX, y: clientY };
        startPos.current = { ...position };
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).tagName === 'SELECT') return;
        handleStart(e.clientX, e.clientY);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if ((e.target as HTMLElement).tagName === 'SELECT') return;
        const touch = e.touches[0];
        handleStart(touch.clientX, touch.clientY);
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging.current) return;
            const dx = e.clientX - dragStart.current.x;
            const dy = e.clientY - dragStart.current.y;
            setPosition({
                x: startPos.current.x + dx,
                y: startPos.current.y + dy
            });
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!isDragging.current) return;
            e.preventDefault();
            const touch = e.touches[0];
            const dx = touch.clientX - dragStart.current.x;
            const dy = touch.clientY - dragStart.current.y;
            setPosition({
                x: startPos.current.x + dx,
                y: startPos.current.y + dy
            });
        };

        const handleEnd = () => {
            isDragging.current = false;
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleEnd);
        window.addEventListener('touchmove', handleTouchMove, { passive: false });
        window.addEventListener('touchend', handleEnd);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleEnd);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleEnd);
        };
    }, []);

    useEffect(() => {
        if (isDemoMode) {
            console.log("[DEMO UI] Triggering School Data Restore");
            restoreTestData();
        }
    }, [isDemoMode, restoreTestData]);

    // Global Unread Listener for Contextual Notifications
    useEffect(() => {
        if (!isDemoMode) return;

        const q = query(collection(db, 'demo_inbox'), where('read', '==', false));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const unreadEmails = snapshot.docs.map(doc => doc.data() as { to: string });

            let notificationTarget = null;

            for (const email of unreadEmails) {
                if (email.to.includes('demo+parent')) notificationTarget = 'Parent';
                else if (email.to.includes('demo+tutor')) notificationTarget = 'Tuteur';
                else if (email.to.includes('demo+teacher')) notificationTarget = 'Enseignant';
                else if (email.to.includes('demo+company')) notificationTarget = 'Entreprise';
                else if (email.to.includes('demo+student')) notificationTarget = 'Élève';
                else if (email.to === 'demo_access@pledgeum.fr') notificationTarget = 'Proviseur';

                // If the notification targets the CURRENT role, hide it (they are already here)
                // Wait, we need to check if the current user email MATCHES the target.
                // Actually, simpler: if I am logged in as Tutor, allow seeing "Un email pour Tuteur" briefly? 
                // No, request says "disparaît une fois que l'utilisateur a changé pour le rôle concerné".
                // So if I am currently that role, I shouldn't see the banner urging me to switch.

                // However, we don't have access to 'userEmail' here easily without store.
                // But 'demoRole' is available.

                if (notificationTarget) {
                    // Check against current role
                    let currentRoleKey = demoRole;
                    // Mapping
                    let targetKey = '';
                    if (notificationTarget === 'Parent') targetKey = 'parent';
                    if (notificationTarget === 'Tuteur') targetKey = 'tutor';
                    if (notificationTarget === 'Enseignant') targetKey = 'teacher';
                    if (notificationTarget === 'Entreprise') targetKey = 'company_head';
                    if (notificationTarget === 'Élève') targetKey = 'student';
                    if (notificationTarget === 'Proviseur') targetKey = 'school_head';

                    if (targetKey === currentRoleKey) {
                        notificationTarget = null; // Don't show if already on it
                        continue; // Look for others? Or just stop? 
                        // If there's one for Student and one for Tutor, and I am Student. 
                        // I should see Tutor.
                    } else {
                        break; // Found a valid notification for ANOTHER role
                    }
                }
            }
            setPendingRoleNotification(notificationTarget);
        });
        return () => unsubscribe();
    }, [isDemoMode, demoRole]);


    const router = useRouter();

    // Only show if demo mode AND connected as a demo user (including +alias)
    const showDemoUI = isDemoMode && email?.startsWith('demo') && email?.endsWith('@pledgeum.fr');

    return (
        <>
            <EmailSimulatorModal />
            {showDemoUI && (
                <div
                    onMouseDown={handleMouseDown}
                    onTouchStart={handleTouchStart}
                    style={{
                        transform: `translate(calc(-50% + ${position.x}px), ${position.y}px)`,
                        transition: 'none',
                        touchAction: 'none'
                    }}
                    className="fixed bottom-4 left-1/2 z-[9999] flex flex-col items-center gap-2 fade-in duration-300 cursor-move select-none"
                >
                    {/* Contextual Notification Bubble */}
                    {pendingRoleNotification && (
                        <div className="bg-orange-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-bold animate-bounce pointer-events-auto mb-2 flex items-center gap-2 max-w-[90vw] text-center">
                            <span className="w-2 h-2 bg-white rounded-full animate-pulse shrink-0"></span>
                            <span>Un email est arrivé pour : {pendingRoleNotification}</span>
                        </div>
                    )}

                    <MockMailbox />

                    {/* Role Selector */}
                    <div className="relative group pointer-events-auto">
                        {/* Animated Hint Arrow - Only show if NO notification, to avoid clutter */}
                        {!pendingRoleNotification && (
                            <div className="absolute -left-12 top-1/2 -translate-y-1/2 animate-bounce hidden group-hover:hidden md:block text-white font-bold drop-shadow-md pointer-events-none">
                                <span className="text-xl">👉</span>
                            </div>
                        )}

                        <div className="bg-indigo-600/90 hover:bg-indigo-500 backdrop-blur-sm text-white pl-2 pr-2 py-1.5 rounded-full shadow-lg flex items-center gap-2 transition-all hover:scale-105 border border-indigo-400/30 max-w-[95vw]">
                            {/* Drag Handle Area */}
                            <div className="flex items-center gap-1 cursor-grab active:cursor-grabbing border-r border-white/20 pr-2">
                                <GripVertical className="w-5 h-5 text-indigo-200" />
                                <span className="text-xs font-bold whitespace-nowrap hidden sm:inline">🦁 Testez chaque rôle</span>
                                <span className="text-xs font-bold whitespace-nowrap sm:hidden">🦁 Rôles</span>
                            </div>

                            <select
                                value={demoRole}
                                onChange={async (e) => {
                                    const newRole = e.target.value as any;
                                    useDemoStore.getState().setDemoRole(newRole);

                                    const { auth } = await import('@/lib/firebase');
                                    const { signInWithEmailAndPassword, createUserWithEmailAndPassword } = await import('firebase/auth');

                                    // Check if NOT logged in (Login Page scenario)
                                    if (!auth.currentUser) {
                                        const emailPrefix = newRole === 'school_head' ? 'demo_access' : `demo+${newRole}`;
                                        const email = newRole === 'school_head' ? 'demo_access@pledgeum.fr' : `${emailPrefix}@pledgeum.fr`;
                                        const password = 'demo1234';

                                        try {
                                            await signInWithEmailAndPassword(auth, email, password);
                                            useDemoStore.getState().setDemoMode(true);
                                            // Router push handled by AuthContext or Page
                                            router.push('/');
                                        } catch (loginErr: any) {
                                            // Handle creation if generic error (user-not-found)
                                            if (loginErr.code === 'auth/user-not-found' || loginErr.code === 'auth/invalid-credential') {
                                                try {
                                                    await createUserWithEmailAndPassword(auth, email, password);
                                                    useDemoStore.getState().setDemoMode(true);
                                                    router.push('/');
                                                } catch (createErr) {
                                                    console.error("Failed to create demo account from switcher", createErr);
                                                    alert("Erreur lors de la création du compte démo.");
                                                }
                                            } else {
                                                console.error("Login failed", loginErr);
                                                alert("Erreur de connexion.");
                                            }
                                        }
                                        return;
                                    }

                                    // Trigger profile refresh to apply new mock data (Existing Logic)
                                    if (auth.currentUser) {
                                        await import('@/store/user').then(({ useUserStore }) =>
                                            useUserStore.getState().fetchUserProfile(auth.currentUser!.uid)
                                        );
                                    }
                                }}
                                className="bg-transparent border-none text-white text-xs font-bold py-0 pr-6 pl-0 cursor-pointer focus:ring-0 hover:bg-white/10 rounded transition-colors uppercase tracking-wide max-w-[120px] sm:max-w-none truncate"
                            >
                                <option className="text-black" value="school_head">Proviseur</option>
                                <option className="text-black" value="student">Élève</option>
                                <option className="text-black" value="parent">Parent</option>
                                <option className="text-black" value="teacher">Enseignant</option>
                                <option className="text-black" value="tutor">Tuteur</option>
                                <option className="text-black" value="company_head">Ent. (Signataire)</option>
                                <option className="text-black" value="business_manager">R-BDE</option>
                                <option className="text-black" value="ddfpt">DDFPT</option>
                            </select>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
