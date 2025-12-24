'use client';

import { Check, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWizardStore } from '@/store/wizard';

const steps = [
    { id: 1, title: 'Établissement' },
    { id: 2, title: 'Élève' },
    { id: 3, title: 'Entreprise' },
    { id: 4, title: 'Stage' },
];

export function Stepper() {
    const { currentStep } = useWizardStore();

    return (
        <div className="w-full py-6">
            <div className="flex items-center justify-center space-x-4">
                {steps.map((step, index) => {
                    const isCompleted = currentStep > step.id;
                    const isCurrent = currentStep === step.id;

                    return (
                        <div key={step.id} className="flex items-center">
                            <div
                                className={cn(
                                    "flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors duration-200",
                                    isCompleted ? "bg-blue-600 border-blue-600 text-white" :
                                        isCurrent ? "border-blue-600 text-blue-600" :
                                            "border-gray-300 text-gray-300"
                                )}
                            >
                                {isCompleted ? <Check className="w-5 h-5" /> : <span className="text-sm font-semibold">{step.id}</span>}
                            </div>
                            <span className={cn(
                                "ml-2 text-sm font-medium hidden sm:block",
                                isCurrent ? "text-blue-900" : "text-gray-500"
                            )}>
                                {step.title}
                            </span>
                            {index < steps.length - 1 && (
                                <div className={cn(
                                    "w-8 h-0.5 mx-2",
                                    currentStep > step.id ? "bg-blue-600" : "bg-gray-300"
                                )} />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
