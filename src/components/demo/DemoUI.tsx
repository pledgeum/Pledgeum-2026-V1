"use client";

import { useEffect } from "react";
import { useDemoStore } from "@/store/demo";
import { useSchoolStore } from "@/store/school";
import { useUserStore } from "@/store/user";
import { EmailSimulatorModal } from "./EmailSimulatorModal";
import { MockMailbox } from "./MockMailbox";

export function DemoUI() {
    const { isDemoMode } = useDemoStore();
    const { restoreTestData } = useSchoolStore();
    const { user } = useUserStore();

    useEffect(() => {
        if (isDemoMode) {
            console.log("[DEMO UI] Triggering School Data Restore");
            restoreTestData();
        }
    }, [isDemoMode, restoreTestData]);

    // Only show if demo mode AND connected as the specific demo user
    const showDemoUI = isDemoMode && user?.email === 'demo@pledgeum.fr';

    return (
        <>
            <EmailSimulatorModal />
            {showDemoUI && (
                <div className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end gap-2 animate-in slide-in-from-bottom-4 fade-in duration-300">
                    <MockMailbox />

                    {/* Role Selector */}
                    <div className="relative group">
                        {/* Animated Hint Arrow */}
                        <div className="absolute -left-12 top-1/2 -translate-y-1/2 animate-bounce hidden group-hover:hidden md:block text-white font-bold drop-shadow-md pointer-events-none">
                            <span className="text-xl">👉</span>
                        </div>

                        <div className="bg-indigo-600/90 hover:bg-indigo-500 backdrop-blur-sm text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 transition-all hover:scale-105">
                            <span className="text-xs font-bold whitespace-nowrap">🦁 Testez les différents rôles :</span>
                            <select
                                value={useDemoStore((state) => state.demoRole)}
                                onChange={async (e) => {
                                    const newRole = e.target.value as any;
                                    useDemoStore.getState().setDemoRole(newRole);
                                    // Trigger profile refresh to apply new mock data
                                    const { auth } = await import('@/lib/firebase');
                                    if (auth.currentUser) {
                                        await import('@/store/user').then(({ useUserStore }) =>
                                            useUserStore.getState().fetchUserProfile(auth.currentUser!.uid)
                                        );
                                    }
                                }}
                                className="bg-transparent border-none text-white text-xs font-bold -ml-1 py-0 pr-6 cursor-pointer focus:ring-0 hover:bg-white/10 rounded transition-colors"
                            >
                                <option className="text-black" value="school_head">Chef d'établissement / Admin</option>
                                <option className="text-black" value="student">Élève</option>
                                <option className="text-black" value="teacher">Enseignant</option>
                                <option className="text-black" value="tutor">Tuteur</option>
                                <option className="text-black" value="business_manager">Responsable BDE</option>
                                <option className="text-black" value="ddfpt">DDFPT</option>
                            </select>
                        </div>

                        <div className="bg-indigo-600/90 hover:bg-indigo-500 backdrop-blur-sm text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 transition-all hover:scale-105 cursor-help" title="Mode Démonstration actif : Les données sont simulées et non sauvegardées.">
                            <span>⚠️ Données Fictives</span>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
