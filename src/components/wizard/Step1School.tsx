'use client';

import { z } from 'zod';
import { StepWrapper } from './StepWrapper';
import { conventionSchema } from '@/types/schema';
import { useWizardStore } from '@/store/wizard';
import { useSchoolStore } from '@/store/school';
import { useUserStore } from '@/store/user';
import { useState, useEffect } from 'react';
import { searchSchools, SchoolResult } from '@/lib/educationApi';
import { Search, MapPin, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Extract relevant fields for this step
const stepSchema = conventionSchema.pick({
    type: true,
    ecole_nom: true,
    ecole_adresse: true,
    ecole_tel: true,
    ecole_chef_nom: true,
    ecole_chef_email: true,
    prof_nom: true,
    prof_email: true,
    ecole_lat: true,
    ecole_lng: true,
});



type Step1Data = z.infer<typeof stepSchema>;

export function Step1School() {
    const { setData, nextStep } = useWizardStore();
    const { profileData, role, email } = useUserStore();
    const { allowedConventionTypes } = useSchoolStore();
    const [cityQuery, setCityQuery] = useState('');
    const [schoolQuery, setSchoolQuery] = useState('');
    const [results, setResults] = useState<SchoolResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);

    useEffect(() => {
        const timer = setTimeout(async () => {
            if (schoolQuery.length > 2 || (cityQuery.length > 2 && schoolQuery.length > 0)) {
                setLoading(true);
                const res = await searchSchools(schoolQuery, cityQuery);
                setResults(res);
                setLoading(false);
                setShowResults(true);
            } else {
                setResults([]);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [schoolQuery, cityQuery]);

    const handleSelectSchool = (school: SchoolResult, form: any) => {
        form.setValue('ecole_nom', school.nom);
        form.setValue('ecole_adresse', `${school.adresse}, ${school.cp} ${school.ville}`);
        if (school.lat) form.setValue('ecole_lat', school.lat);
        if (school.lng) form.setValue('ecole_lng', school.lng);
        setSchoolQuery(school.nom); // Update search box to match
        setShowResults(false);
    };

    const handleNext = (data: Step1Data) => {
        setData(data);
        nextStep();
    };

    return (
        <StepWrapper<Step1Data>
            title="L'Établissement Scolaire"
            description="Informations concernant le lycée professionnel ou le CFA."
            schema={stepSchema}
            onNext={handleNext}
        >
            {(form) => {
                // Compute derived state for Teacher Locking
                const studentClass = role === 'student' ? (profileData.class || profileData.classe) : null;
                const targetClass = studentClass ? useSchoolStore.getState().classes.find(c => c.name === studentClass) : null;
                const lockedMainTeacher = targetClass?.mainTeacher;

                // Explicit Lock for School Data (Student view OR Demo mode)
                // We treat 'demo@pledgeum.fr' as a student to demonstrate the UI locking
                const isSchoolLocked = role === 'student' || email === 'pledgeum@gmail.com' || email === 'demo@pledgeum.fr';

                useEffect(() => {
                    // Pre-fill from School Store (Single Source of Truth)
                    const { schoolName, schoolAddress, schoolPhone, schoolHeadName, schoolHeadEmail } = useSchoolStore.getState();

                    // Always overwrite if locked to ensure consistency with admin settings
                    if (isSchoolLocked || !form.getValues('ecole_nom')) {
                        if (schoolName) form.setValue('ecole_nom', schoolName);
                        if (schoolAddress) form.setValue('ecole_adresse', schoolAddress);
                        if (schoolPhone) form.setValue('ecole_tel', schoolPhone);
                        if (schoolHeadName) form.setValue('ecole_chef_nom', schoolHeadName);
                        if (schoolHeadEmail) form.setValue('ecole_chef_email', schoolHeadEmail);
                    }

                    // Auto-fill Teacher if locked
                    if (lockedMainTeacher) {
                        form.setValue('prof_nom', `${lockedMainTeacher.firstName} ${lockedMainTeacher.lastName}`);
                        form.setValue('prof_email', lockedMainTeacher.email);
                    }
                }, [form, useSchoolStore.getState().schoolName, lockedMainTeacher, isSchoolLocked]); // Trigger on mount or name change

                // Auto-reset convention type if current value is not allowed
                useEffect(() => {
                    const currentType = form.getValues('type');
                    // Check if current type is valid relative to allowed list
                    // If allowed list is not empty and current type is not in it (or not set)
                    if (allowedConventionTypes && allowedConventionTypes.length > 0) {
                        if (!currentType || !allowedConventionTypes.includes(currentType)) {
                            // Default to the first allowed type
                            form.setValue('type', allowedConventionTypes[0] as "PFMP_STANDARD" | "STAGE_2NDE" | "ERASMUS_MOBILITY");
                        }
                    }
                }, [allowedConventionTypes, form.watch('type')]);


                return (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        {/* Convention Type Configuration */}
                        <div className="md:col-span-2 bg-indigo-50 p-4 rounded-xl border border-indigo-100 mb-2">
                            <label className="block text-sm font-bold text-indigo-900 mb-2">Type de Convention</label>
                            <select
                                {...form.register('type')}
                                className="block w-full rounded-md border-indigo-200 focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2 bg-white"
                            >
                                <option value="PFMP_STANDARD" disabled={allowedConventionTypes && !allowedConventionTypes.includes('PFMP_STANDARD')}>
                                    PFMP Lycée Professionnel (Standard) {allowedConventionTypes && !allowedConventionTypes.includes('PFMP_STANDARD') && '(Non activé)'}
                                </option>
                                <option value="STAGE_2NDE" disabled={allowedConventionTypes && !allowedConventionTypes.includes('STAGE_2NDE')}>
                                    Stage de Seconde {allowedConventionTypes && !allowedConventionTypes.includes('STAGE_2NDE') && '(En cours de développement)'}
                                </option>
                                <option value="ERASMUS_MOBILITY" disabled={allowedConventionTypes && !allowedConventionTypes.includes('ERASMUS_MOBILITY')}>
                                    Mobilité Erasmus+ {allowedConventionTypes && !allowedConventionTypes.includes('ERASMUS_MOBILITY') && '(En cours de développement)'}
                                </option>
                            </select>
                            <p className="text-xs text-indigo-600 mt-1">
                                Le choix du type détermine le format légal de la convention générée. Les options grisées sont en cours de développement ou désactivées par votre établissement.
                            </p>
                        </div>

                        {/* Search School - Check if NOT locked (so not student and not debug account) */}
                        {!isSchoolLocked && (
                            <div className="md:col-span-2 bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4">
                                <h4 className="flex items-center text-blue-900 font-semibold mb-3">
                                    <Search className="w-4 h-4 mr-2" />
                                    Recherche Rapide de l'Établissement
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-blue-800 mb-1">Ville</label>
                                        <input
                                            type="text"
                                            value={cityQuery}
                                            onChange={(e) => setCityQuery(e.target.value)}
                                            placeholder="Ex: Lyon"
                                            className="block w-full rounded-md border-blue-200 focus:border-blue-500 focus:ring-blue-500 text-sm p-2"
                                        />
                                    </div>
                                    <div className="relative">
                                        <label className="block text-xs font-medium text-blue-800 mb-1">Nom de l'école</label>
                                        <input
                                            type="text"
                                            value={schoolQuery}
                                            onChange={(e) => {
                                                setSchoolQuery(e.target.value);
                                                setShowResults(true);
                                            }}
                                            placeholder="Ex: Jules Ferry"
                                            className="block w-full rounded-md border-blue-200 focus:border-blue-500 focus:ring-blue-500 text-sm p-2"
                                        />
                                        {loading && (
                                            <div className="absolute right-2 top-8">
                                                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                            </div>
                                        )}
                                        {showResults && results.length > 0 && (
                                            <div className="absolute z-10 w-full bg-white mt-1 rounded-md shadow-lg border border-gray-200 max-h-60 overflow-y-auto">
                                                {results.map((school) => (
                                                    <button
                                                        key={school.id}
                                                        type="button"
                                                        onClick={() => handleSelectSchool(school, form)}
                                                        className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm border-b border-gray-100 last:border-0"
                                                    >
                                                        <div className="font-medium text-gray-900">{school.nom}</div>
                                                        <div className="text-xs text-gray-500 flex items-center">
                                                            <MapPin className="w-3 h-3 mr-1" />
                                                            {school.ville} ({school.type})
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Nom de l'établissement (Vérifiez)</label>
                            <input
                                {...form.register('ecole_nom')}
                                type="text"
                                disabled={isSchoolLocked}
                                readOnly={isSchoolLocked}
                                className={cn(
                                    "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border",
                                    isSchoolLocked && "bg-gray-200 text-gray-700 cursor-not-allowed",
                                    form.formState.errors.ecole_nom && "border-red-500 focus:border-red-500 focus:ring-red-500"
                                )}
                            />
                            {form.formState.errors.ecole_nom && <p className="text-red-500 text-xs mt-1">{form.formState.errors.ecole_nom.message}</p>}
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Adresse complète</label>
                            <textarea
                                {...form.register('ecole_adresse')}
                                rows={2}
                                disabled={isSchoolLocked}
                                readOnly={isSchoolLocked}
                                className={cn(
                                    "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border",
                                    isSchoolLocked && "bg-gray-200 text-gray-700 cursor-not-allowed",
                                    form.formState.errors.ecole_adresse && "border-red-500 focus:border-red-500 focus:ring-red-500"
                                )}
                            />
                            {form.formState.errors.ecole_adresse && <p className="text-red-500 text-xs mt-1">{form.formState.errors.ecole_adresse.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Téléphone standard</label>
                            <input
                                {...form.register('ecole_tel')}
                                type="tel"
                                disabled={isSchoolLocked}
                                readOnly={isSchoolLocked}
                                className={cn(
                                    "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border",
                                    isSchoolLocked && "bg-gray-200 text-gray-700 cursor-not-allowed",
                                    form.formState.errors.ecole_tel && "border-red-500 focus:border-red-500 focus:ring-red-500"
                                )}
                            />
                        </div>

                        <div className="hidden md:block"></div> {/* Spacer */}

                        <div className="md:col-span-2 border-t pt-4 mt-2">
                            <h3 className="text-sm font-semibold text-gray-900 mb-4">Représentant de l'établissement</h3>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Nom du Chef d'Établissement scolaire</label>
                            <input
                                {...form.register('ecole_chef_nom')}
                                type="text"
                                disabled={isSchoolLocked}
                                readOnly={isSchoolLocked}
                                className={cn(
                                    "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border",
                                    isSchoolLocked && "bg-gray-200 text-gray-700 cursor-not-allowed",
                                    form.formState.errors.ecole_chef_nom && "border-red-500 focus:border-red-500 focus:ring-red-500"
                                )}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Email (pour signature)</label>
                            <input
                                {...form.register('ecole_chef_email')}
                                type="email"
                                disabled={isSchoolLocked}
                                readOnly={isSchoolLocked}
                                className={cn(
                                    "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border",
                                    isSchoolLocked && "bg-gray-200 text-gray-700 cursor-not-allowed",
                                    form.formState.errors.ecole_chef_email && "border-red-500 focus:border-red-500 focus:ring-red-500"
                                )}
                            />
                            {form.formState.errors.ecole_chef_email && <p className="text-red-500 text-xs mt-1">{form.formState.errors.ecole_chef_email.message}</p>}
                        </div>

                        <div className="md:col-span-2 border-t pt-4 mt-2">
                            <h3 className="text-sm font-semibold text-gray-900 mb-4">Suivi Pédagogique</h3>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Enseignant Référent/Professeur Principal</label>
                            <input
                                {...form.register('prof_nom')}
                                type="text"
                                disabled={!!lockedMainTeacher}
                                className={cn(
                                    "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border",
                                    !!lockedMainTeacher && "bg-gray-200 text-gray-500 cursor-not-allowed",
                                    form.formState.errors.prof_nom && "border-red-500 focus:border-red-500 focus:ring-red-500"
                                )}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Email Référent</label>
                            <input
                                {...form.register('prof_email')}
                                type="email"
                                disabled={!!lockedMainTeacher}
                                className={cn(
                                    "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border",
                                    !!lockedMainTeacher && "bg-gray-200 text-gray-500 cursor-not-allowed",
                                    form.formState.errors.prof_email && "border-red-500 focus:border-red-500 focus:ring-red-500"
                                )}
                            />
                        </div>

                    </div>
                );
            }}
        </StepWrapper>
    );
}
