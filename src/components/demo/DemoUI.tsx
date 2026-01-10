"use client";

import { useEffect } from "react";
import { useDemoStore } from "@/store/demo";
import { useSchoolStore } from "@/store/school";
import { EmailSimulatorModal } from "./EmailSimulatorModal";

export function DemoUI() {
    const { isDemoMode } = useDemoStore();
    const { restoreTestData } = useSchoolStore();

    useEffect(() => {
        if (isDemoMode) {
            console.log("[DEMO UI] Triggering School Data Restore");
            restoreTestData();
        }
    }, [isDemoMode, restoreTestData]);

    return (
        <>
            <EmailSimulatorModal />
            {isDemoMode && (
                <div className="fixed bottom-4 right-4 bg-orange-600/90 hover:bg-orange-600 backdrop-blur-sm text-white px-4 py-2 rounded-full shadow-lg text-xs font-bold z-[9999] flex items-center gap-2 transition-all hover:scale-105 cursor-help" title="Mode Démonstration actif : Les données sont simulées et non sauvegardées.">
                    <span>🦁 Mode Démo</span>
                </div>
            )}
        </>
    );
}
