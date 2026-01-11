"use client";

import { useEffect, useState, useRef } from "react";
import { useDemoStore } from "@/store/demo";
import { useSchoolStore } from "@/store/school";
import { useUserStore } from "@/store/user";
import { EmailSimulatorModal } from "./EmailSimulatorModal";
import { MockMailbox } from "./MockMailbox";
import { GripVertical } from "lucide-react";

export function DemoUI() {
    const isDemoMode = useDemoStore((state) => state.isDemoMode);
    const demoRole = useDemoStore((state) => state.demoRole);
    const restoreTestData = useSchoolStore((state) => state.restoreTestData);
    const email = useUserStore((state) => state.email);

    // Drag Logic
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const isDragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const startPos = useRef({ x: 0, y: 0 });

    const handleMouseDown = (e: React.MouseEvent) => {
        // Prevent drag if interacting with select
        if ((e.target as HTMLElement).tagName === 'SELECT') return;

        isDragging.current = true;
        dragStart.current = { x: e.clientX, y: e.clientY };
        startPos.current = { ...position };
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

        const handleMouseUp = () => {
            isDragging.current = false;
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    useEffect(() => {
        if (isDemoMode) {
            console.log("[DEMO UI] Triggering School Data Restore");
            restoreTestData();
        }
    }, [isDemoMode, restoreTestData]);

    // Only show if demo mode AND connected as the specific demo user
    const showDemoUI = isDemoMode && email === 'demo@pledgeum.fr';

    return (
        <>
            <EmailSimulatorModal />
            {showDemoUI && (
                <div
                    onMouseDown={handleMouseDown}
                    style={{ transform: `translate(calc(-50% + ${position.x}px), ${position.y}px)` }}
                    className="fixed bottom-4 left-1/2 z-[9999] flex flex-col items-center gap-2 fade-in duration-300 cursor-move select-none"
                >
                    <MockMailbox />

                    {/* Role Selector */}
                    <div className="relative group">
                        {/* Animated Hint Arrow */}
                        <div className="absolute -left-12 top-1/2 -translate-y-1/2 animate-bounce hidden group-hover:hidden md:block text-white font-bold drop-shadow-md pointer-events-none">
                            <span className="text-xl">👉</span>
                        </div>

                        <div className="bg-indigo-600/90 hover:bg-indigo-500 backdrop-blur-sm text-white pl-3 pr-4 py-2 rounded-full shadow-lg flex items-center gap-3 transition-all hover:scale-105 border border-indigo-400/30">
                            {/* Drag Handle Area */}
                            <div className="flex items-center gap-2 cursor-grab active:cursor-grabbing border-r border-white/20 pr-3">
                                <GripVertical className="w-5 h-5 text-indigo-200" />
                                <span className="text-xs font-bold whitespace-nowrap">🦁 Testez chaque rôle</span>
                            </div>

                            <select
                                value={demoRole}
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
                                className="bg-transparent border-none text-white text-xs font-bold py-0 pr-8 pl-1 cursor-pointer focus:ring-0 hover:bg-white/10 rounded transition-colors uppercase tracking-wide"
                            >
                                <option className="text-black" value="school_head">Chef d'établissement</option>
                                <option className="text-black" value="student">Élève</option>
                                <option className="text-black" value="teacher">Enseignant</option>
                                <option className="text-black" value="tutor">Tuteur</option>
                                <option className="text-black" value="business_manager">Resp. BDE</option>
                                <option className="text-black" value="ddfpt">DDFPT</option>
                            </select>
                        </div>


                    </div>
                </div>
            )}
        </>
    );
}
