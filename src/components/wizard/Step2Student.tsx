'use client';

import { z } from 'zod';
import { StepWrapper } from './StepWrapper';
import { conventionSchema } from '@/types/schema';
import { useWizardStore } from '@/store/wizard';
import { useUserStore } from '@/store/user';
import { useEffect } from 'react';
import { differenceInYears } from 'date-fns';
import { cn } from '@/lib/utils';

const stepSchema = conventionSchema.pick({
    eleve_nom: true,
    eleve_prenom: true,
    eleve_date_naissance: true,
    eleve_adresse: true,
    eleve_cp: true,
    eleve_ville: true,
    eleve_tel: true,
    eleve_email: true,
    eleve_classe: true,
    diplome_intitule: true,
    est_mineur: true,
    rep_legal_nom: true,
    rep_legal_adresse: true,
    rep_legal_email: true,
    rep_legal_tel: true,
}).refine((data) => {
    if (data.est_mineur) {
        return !!data.rep_legal_nom && data.rep_legal_nom.length > 2;
    }
    return true;
}, {
    message: "Le nom du représentant légal est requis pour un mineur",
    path: ["rep_legal_nom"],
});

type Step2Data = z.infer<typeof stepSchema>;

export function Step2Student() {
    const { setData, nextStep } = useWizardStore();
    const { profileData } = useUserStore();

    const handleNext = (data: Step2Data) => {
        setData(data);
        nextStep();
    };

    return (
        <StepWrapper<Step2Data>
            title="L'Élève Stagiaire"
            description="Identité et cursus de l'élève."
            schema={stepSchema}
            onNext={handleNext}
        >
            {(form) => {
                // Watch DOB to auto-calculate minor status
                const dob = form.watch('eleve_date_naissance');
                const isMinor = form.watch('est_mineur');

                useEffect(() => {
                    if (dob) {
                        const birthDate = new Date(dob);
                        const today = new Date();

                        let age = today.getFullYear() - birthDate.getFullYear();
                        const m = today.getMonth() - birthDate.getMonth();
                        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                            age--;
                        }

                        const minor = age < 18;
                        if (minor !== isMinor) {
                            form.setValue('est_mineur', minor, { shouldValidate: true });

                            // If becoming major (false), clear parent fields to prevent hidden validation errors
                            if (!minor) {
                                form.setValue('rep_legal_nom', '', { shouldValidate: true });
                                form.setValue('rep_legal_email', '', { shouldValidate: true });
                                form.setValue('rep_legal_tel', '', { shouldValidate: true });
                                form.setValue('rep_legal_adresse', '', { shouldValidate: true });
                            }
                        }
                    }
                }, [dob, isMinor, form]);

                // Manually register est_mineur to avoid string coercion issues from hidden inputs
                useEffect(() => {
                    form.register('est_mineur');
                }, [form]);

                useEffect(() => {
                    if (profileData) {
                        const setIfEmpty = (field: any, val: any) => {
                            if (val && !form.getValues(field)) {
                                form.setValue(field, val, { shouldValidate: true });
                            }
                        };
                        setIfEmpty('eleve_nom', profileData.lastName);
                        setIfEmpty('eleve_prenom', profileData.firstName);
                        setIfEmpty('eleve_date_naissance', profileData.birthDate);
                        setIfEmpty('eleve_email', profileData.email);
                        setIfEmpty('eleve_tel', profileData.phone);

                        // Address handling (Object vs String legacy)
                        if (profileData.address && typeof profileData.address === 'object') {
                            const addr = profileData.address as any;
                            setIfEmpty('eleve_adresse', addr.street || addr.address); // Fallback for safety
                            setIfEmpty('eleve_cp', addr.postalCode || addr.zipCode || addr.cp); // Handle potential naming variance
                            setIfEmpty('eleve_ville', addr.city || addr.ville);
                        } else {
                            setIfEmpty('eleve_adresse', profileData.address);
                            setIfEmpty('eleve_cp', profileData.zipCode || profileData.postalCode);
                            setIfEmpty('eleve_ville', profileData.city);
                        }

                        setIfEmpty('eleve_classe', profileData.class);
                        setIfEmpty('diplome_intitule', profileData.diploma);

                        // Only pre-fill parent data if the student is MINOR (based on calculated age)
                        let isMinorProfile = false;
                        if (profileData.birthDate) {
                            const birthDate = new Date(profileData.birthDate);
                            const today = new Date();
                            let age = today.getFullYear() - birthDate.getFullYear();
                            const m = today.getMonth() - birthDate.getMonth();
                            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                                age--;
                            }
                            isMinorProfile = age < 18;
                        }

                        if (isMinorProfile) {
                            // Legal Representatives (New Array Structure)
                            if (profileData.legalRepresentatives && Array.isArray(profileData.legalRepresentatives) && profileData.legalRepresentatives.length > 0) {
                                const rep1 = profileData.legalRepresentatives[0];
                                const fullName = `${rep1.firstName || ''} ${rep1.lastName || ''}`.trim();
                                setIfEmpty('rep_legal_nom', fullName);
                                setIfEmpty('rep_legal_email', rep1.email);
                                setIfEmpty('rep_legal_tel', rep1.phone);

                                if (rep1.address && typeof rep1.address === 'object') {
                                    const a = rep1.address;
                                    setIfEmpty('rep_legal_adresse', `${a.street || ''} ${a.postalCode || ''} ${a.city || ''}`.trim());
                                }
                            } else {
                                // Fallback to flat fields
                                setIfEmpty('rep_legal_nom', profileData.parentName);
                                setIfEmpty('rep_legal_email', profileData.parentEmail);
                                setIfEmpty('rep_legal_tel', profileData.parentPhone);
                                setIfEmpty('rep_legal_adresse', profileData.parentAddress);
                            }
                        }
                    }
                }, [profileData, form]);

                return (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        {/* est_mineur is registered via useEffect */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Nom</label>
                            <input
                                {...form.register('eleve_nom')}
                                className={cn(
                                    "mt-1 block w-full rounded-md shadow-sm sm:text-sm p-2 border",
                                    form.formState.errors.eleve_nom
                                        ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                                        : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                                )}
                            />
                            {form.formState.errors.eleve_nom && <p className="text-red-500 text-xs mt-1">{form.formState.errors.eleve_nom.message}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Prénom</label>
                            <input
                                {...form.register('eleve_prenom')}
                                className={cn(
                                    "mt-1 block w-full rounded-md shadow-sm sm:text-sm p-2 border",
                                    form.formState.errors.eleve_prenom
                                        ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                                        : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                                )}
                            />
                            {form.formState.errors.eleve_prenom && <p className="text-red-500 text-xs mt-1">{form.formState.errors.eleve_prenom.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Date de Naissance</label>
                            <input
                                {...form.register('eleve_date_naissance')}
                                type="date"
                                className={cn(
                                    "mt-1 block w-full rounded-md shadow-sm sm:text-sm p-2 border",
                                    form.formState.errors.eleve_date_naissance
                                        ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                                        : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                                )}
                            />
                            {form.formState.errors.eleve_date_naissance && <p className="text-red-500 text-xs mt-1">{form.formState.errors.eleve_date_naissance.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Email Élève</label>
                            <input
                                {...form.register('eleve_email')}
                                type="email"
                                className={cn(
                                    "mt-1 block w-full rounded-md shadow-sm sm:text-sm p-2 border",
                                    form.formState.errors.eleve_email
                                        ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                                        : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                                )}
                            />
                            {form.formState.errors.eleve_email && <p className="text-red-500 text-xs mt-1">{form.formState.errors.eleve_email.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Téléphone Élève (Optionnel)</label>
                            <input
                                {...form.register('eleve_tel')}
                                type="tel"
                                className={cn(
                                    "mt-1 block w-full rounded-md shadow-sm sm:text-sm p-2 border",
                                    form.formState.errors.eleve_tel
                                        ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                                        : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                                )}
                            />
                            {form.formState.errors.eleve_tel && <p className="text-red-500 text-xs mt-1">{form.formState.errors.eleve_tel.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Classe</label>
                            <div className="relative">
                                <input
                                    {...form.register('eleve_classe')}
                                    disabled={!!profileData?.class} // Lock if coming from profile
                                    className={cn(
                                        "mt-1 block w-full rounded-md shadow-sm sm:text-sm p-2 border",
                                        form.formState.errors.eleve_classe
                                            ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                                            : "border-gray-300 focus:border-blue-500 focus:ring-blue-500",
                                        profileData?.class ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""
                                    )}
                                />
                                {profileData?.class && (
                                    <span className="absolute right-3 top-3 text-xs text-gray-400 italic">
                                        (Fixé par l'établissement)
                                    </span>
                                )}
                            </div>
                            {form.formState.errors.eleve_classe && <p className="text-red-500 text-xs mt-1">{form.formState.errors.eleve_classe.message}</p>}
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Diplôme Préparé</label>
                            <input
                                {...form.register('diplome_intitule')}
                                placeholder="Ex: Bac Pro Systèmes Numériques"
                                className={cn(
                                    "mt-1 block w-full rounded-md shadow-sm sm:text-sm p-2 border",
                                    form.formState.errors.diplome_intitule
                                        ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                                        : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                                )}
                            />
                            {form.formState.errors.diplome_intitule && <p className="text-red-500 text-xs mt-1">{form.formState.errors.diplome_intitule.message}</p>}
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Adresse Personnelle</label>
                            <textarea
                                {...form.register('eleve_adresse')}
                                rows={2}
                                className={cn(
                                    "mt-1 block w-full rounded-md shadow-sm sm:text-sm p-2 border",
                                    form.formState.errors.eleve_adresse
                                        ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                                        : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                                )}
                            />
                            {form.formState.errors.eleve_adresse && <p className="text-red-500 text-xs mt-1">{form.formState.errors.eleve_adresse.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Code Postal</label>
                            <input
                                {...form.register('eleve_cp')}
                                className={cn(
                                    "mt-1 block w-full rounded-md shadow-sm sm:text-sm p-2 border",
                                    form.formState.errors.eleve_cp
                                        ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                                        : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                                )}
                            />
                            {form.formState.errors.eleve_cp && <p className="text-red-500 text-xs mt-1">{form.formState.errors.eleve_cp.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Ville</label>
                            <input
                                {...form.register('eleve_ville')}
                                className={cn(
                                    "mt-1 block w-full rounded-md shadow-sm sm:text-sm p-2 border",
                                    form.formState.errors.eleve_ville
                                        ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                                        : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                                )}
                            />
                            {form.formState.errors.eleve_ville && <p className="text-red-500 text-xs mt-1">{form.formState.errors.eleve_ville.message}</p>}
                        </div>

                        {isMinor && (
                            <div className="md:col-span-2 bg-blue-50 p-4 rounded-md border border-blue-200 mt-2">
                                <h4 className="text-blue-900 font-semibold mb-2 flex items-center">
                                    ⚠️ Élève Mineur détecté
                                </h4>
                                <p className="text-sm text-blue-700 mb-4">La signature du responsable légal est obligatoire.</p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-blue-900">Nom du Responsable Légal</label>
                                        <input
                                            {...form.register('rep_legal_nom')}
                                            className={cn(
                                                "mt-1 block w-full rounded-md shadow-sm sm:text-sm p-2 border",
                                                form.formState.errors.rep_legal_nom
                                                    ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                                                    : "border-blue-300 focus:border-blue-500 focus:ring-blue-500"
                                            )}
                                        />
                                        {form.formState.errors.rep_legal_nom && <p className="text-red-500 text-xs mt-1">{form.formState.errors.rep_legal_nom.message}</p>}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-blue-900">Email Responsable</label>
                                        <input
                                            {...form.register('rep_legal_email')}
                                            type="email"
                                            className={cn(
                                                "mt-1 block w-full rounded-md shadow-sm sm:text-sm p-2 border",
                                                form.formState.errors.rep_legal_email
                                                    ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                                                    : "border-blue-300 focus:border-blue-500 focus:ring-blue-500"
                                            )}
                                        />
                                        {form.formState.errors.rep_legal_email && <p className="text-red-500 text-xs mt-1">{form.formState.errors.rep_legal_email.message}</p>}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-blue-900">Téléphone Responsable</label>
                                        <input
                                            {...form.register('rep_legal_tel')}
                                            type="tel"
                                            className={cn(
                                                "mt-1 block w-full rounded-md shadow-sm sm:text-sm p-2 border",
                                                form.formState.errors.rep_legal_tel
                                                    ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                                                    : "border-blue-300 focus:border-blue-500 focus:ring-blue-500"
                                            )}
                                        />
                                        {form.formState.errors.rep_legal_tel && <p className="text-red-500 text-xs mt-1">{form.formState.errors.rep_legal_tel.message}</p>}
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-blue-900">Adresse Responsable (si différente)</label>
                                        <input
                                            {...form.register('rep_legal_adresse')}
                                            className={cn(
                                                "mt-1 block w-full rounded-md shadow-sm sm:text-sm p-2 border",
                                                form.formState.errors.rep_legal_adresse
                                                    ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                                                    : "border-blue-300 focus:border-blue-500 focus:ring-blue-500"
                                            )}
                                        />
                                        {form.formState.errors.rep_legal_adresse && <p className="text-red-500 text-xs mt-1">{form.formState.errors.rep_legal_adresse.message}</p>}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                );
            }}
        </StepWrapper>
    );
}
