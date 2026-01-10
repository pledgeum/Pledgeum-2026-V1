import { create } from 'zustand';

interface SimulatedEmail {
    to: string;
    subject: string;
    text: string;
}

interface DemoState {
    isDemoMode: boolean;
    simulatedEmail: SimulatedEmail | null;
    setDemoMode: (isDemo: boolean) => void;
    openEmailModal: (email: SimulatedEmail) => void;
    closeEmailModal: () => void;
}

export const useDemoStore = create<DemoState>((set) => ({
    isDemoMode: false,
    simulatedEmail: null,
    setDemoMode: (isDemo) => set({ isDemoMode: isDemo }),
    openEmailModal: (email) => set({ simulatedEmail: email }),
    closeEmailModal: () => set({ simulatedEmail: null }),
}));
