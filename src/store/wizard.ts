import { create } from 'zustand';
import { ConventionData } from '@/types/schema';

interface WizardState {
    currentStep: number;
    data: Partial<ConventionData>;
    setData: (data: Partial<ConventionData>) => void;
    nextStep: () => void;
    prevStep: () => void;
    goToStep: (step: number) => void;
    reset: () => void;
}

export const useWizardStore = create<WizardState>((set) => ({
    currentStep: 1,
    data: {},
    setData: (newData) => set((state) => ({ data: { ...state.data, ...newData } })),
    nextStep: () => set((state) => ({ currentStep: Math.min(state.currentStep + 1, 5) })),
    prevStep: () => set((state) => ({ currentStep: Math.max(state.currentStep - 1, 1) })),
    goToStep: (step) => set({ currentStep: step }),
    reset: () => set({ currentStep: 1, data: {} }),
}));
