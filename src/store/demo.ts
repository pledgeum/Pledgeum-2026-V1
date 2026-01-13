import { create } from 'zustand';
import { UserRole } from './user';

interface SimulatedEmail {
    to: string;
    subject: string;
    text: string;
}

interface DemoState {
    isDemoMode: boolean;
    demoRole: UserRole;
    simulatedEmail: SimulatedEmail | null;
    setDemoMode: (isDemo: boolean) => void;
    setDemoRole: (role: UserRole) => void;
    openEmailModal: (email: SimulatedEmail) => void;
    closeEmailModal: () => void;
    reset: () => void;
}

export const useDemoStore = create<DemoState>((set) => ({
    isDemoMode: false,
    demoRole: 'school_head', // Default role
    simulatedEmail: null,
    setDemoMode: (isDemo) => set({ isDemoMode: isDemo }),
    setDemoRole: (role) => set({ demoRole: role }),
    openEmailModal: (email) => set({ simulatedEmail: email }),
    closeEmailModal: () => set({ simulatedEmail: null }),
    reset: () => set({ isDemoMode: false, simulatedEmail: null })
}));
