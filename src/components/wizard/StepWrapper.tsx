'use client';

import { ReactNode, useEffect } from 'react';
import { useForm, UseFormReturn, FieldValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z, ZodSchema } from 'zod';
import { useWizardStore } from '@/store/wizard';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface StepWrapperProps<T extends FieldValues> {
    title: string;
    description?: string;
    children: (form: UseFormReturn<T>) => ReactNode;
    schema: ZodSchema<any>;
    onNext: (data: T) => void;
    isNextDisabled?: boolean;
}

export function StepWrapper<T extends FieldValues>({
    title,
    description,
    children,
    schema,
    onNext,
    isNextDisabled = false,
}: StepWrapperProps<T>) {
    const { currentStep, prevStep, data } = useWizardStore();

    const form = useForm<T>({
        resolver: zodResolver(schema as any),
        defaultValues: data as any,
    });

    useEffect(() => {
        form.reset(data as any);
    }, [data, form]);

    const onSubmit = (formData: T) => {
        onNext(formData);
    };

    return (
        <div className="max-w-2xl mx-auto p-6 bg-white shadow-sm rounded-xl border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
                {description && <p className="text-gray-500 mt-1">{description}</p>}
            </div>

            <form
                onSubmit={form.handleSubmit(onSubmit, (errors) => {
                    console.warn("Form validation errors:", JSON.stringify(errors, (key, value) => {
                        if (key === 'ref') return undefined;
                        return value;
                    }, 2));
                })}
                className="space-y-6"
            >
                {children(form)}

                {Object.keys(form.formState.errors).length > 0 && (
                    <div className="rounded-md bg-red-50 p-4 border border-red-200 animate-in slide-in-from-top-2">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-red-800">
                                    Des erreurs sont présentes dans le formulaire
                                </h3>
                                <div className="mt-2 text-sm text-red-700">
                                    <p>Veuillez corriger les champs indiqués en rouge avant de continuer.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="pb-24"></div> {/* Spacer for floating buttons */}

                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] flex justify-between items-center z-40 md:bg-transparent md:border-none md:shadow-none md:pointer-events-none">
                    <div className="w-full max-w-4xl mx-auto flex justify-between px-4 md:px-0 pointer-events-auto">
                        <button
                            type="button"
                            onClick={prevStep}
                            disabled={currentStep === 1}
                            className={cn(
                                "flex items-center px-4 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-full shadow-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-transform hover:scale-105",
                                currentStep === 1 && "invisible"
                            )}
                        >
                            <ChevronLeft className="w-5 h-5 mr-1" />
                            Précédent
                        </button>

                        <button
                            type="submit"
                            disabled={isNextDisabled}
                            className={cn(
                                "flex items-center px-6 py-3 text-base font-bold text-white bg-blue-600 border border-transparent rounded-full shadow-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-transform hover:scale-105",
                                isNextDisabled && "bg-gray-400 cursor-not-allowed hover:bg-gray-400"
                            )}
                        >
                            Suivant
                            <ChevronRight className="w-5 h-5 ml-1" />
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
