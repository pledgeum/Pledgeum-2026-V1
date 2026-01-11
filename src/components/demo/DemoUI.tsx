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
            e.preventDefault(); // Prevent scrolling while dragging
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

    // Only show if demo mode AND connected as the specific demo user
    const showDemoUI = isDemoMode && email === 'demo@pledgeum.fr';

    return (
        <>
            <EmailSimulatorModal />
            {showDemoUI && (
                <div
                    onMouseDown={handleMouseDown}
                    onTouchStart={handleTouchStart}
                    style={{
                        transform: `translate(calc(-50% + ${position.x}px), ${position.y}px)`,
                        transition: 'none', // Critical for 1:1 drag movement
                        touchAction: 'none' // Critical for mobile: prevents browser scrolling
                    }}
                    className="fixed bottom-4 left-1/2 z-[9999] flex flex-col items-center gap-2 fade-in duration-300 cursor-move select-none"
                >
                    <MockMailbox />

                    {/* Role Selector */}
                    <div className="relative group">
                        {/* Animated Hint Arrow */}
                        <div className="absolute -left-12 top-1/2 -translate-y-1/2 animate-bounce hidden group-hover:hidden md:block text-white font-bold drop-shadow-md pointer-events-none">
                            <span className="text-xl">👉</span>
                        </div>

                        <div className="bg-indigo-600/90 hover:bg-indigo-500 backdrop-blur-sm text-white pl-2 pr-2 py-1.5 rounded-full shadow-lg flex items-center gap-2 transition-all hover:scale-105 border border-indigo-400/30 max-w-[95vw]">
                            {/* Drag Handle Area */}
                            <div className="flex items-center gap-1 cursor-grab active:cursor-grabbing border-r border-white/20 pr-2">
                                <GripVertical className="w-5 h-5 text-indigo-200" />
                                <span className="text-xs font-bold whitespace-nowrap hidden sm:inline">🦁 Testez chaque rôle</span>
                                <span className="text-xs font-bold whitespace-nowrap sm:hidden">🦁 Tester des rôles</span>
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
                                className="bg-transparent border-none text-white text-xs font-bold py-0 pr-6 pl-0 cursor-pointer focus:ring-0 hover:bg-white/10 rounded transition-colors uppercase tracking-wide max-w-[120px] sm:max-w-none truncate"
                            >
                                <option className="text-black" value="school_head">Directeur</option>
                                <option className="text-black" value="student">Élève</option>
                                <option className="text-black" value="teacher">Enseignant</option>
                                <option className="text-black" value="tutor">Tuteur</option>
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
