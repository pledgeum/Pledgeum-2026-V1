'use client';

import { useEffect, useState } from 'react';

import { z } from 'zod';
import { StepWrapper } from './StepWrapper';
import { conventionSchema } from '@/types/schema';
import { useWizardStore } from '@/store/wizard';
import { useSchoolStore, PfmpPeriod } from '@/store/school';
import { FileText, MapPin, Search, Calendar, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { differenceInDays, isWithinInterval, parseISO, format } from 'date-fns';

const stepSchema = conventionSchema.pick({
    stage_date_debut: true,
    stage_date_fin: true,
    stage_duree_heures: true,
    stage_activites: true,
    stage_lieu: true,
    stage_adresse_differente: true,
    stage_horaires: true,
});

type Step4Data = z.infer<typeof stepSchema>;

export function Step4Internship() {
    const { setData, data: allData, nextStep } = useWizardStore();

    const { classes } = useSchoolStore();
    const [warnings, setWarnings] = useState<string[]>([]);

    // Find Student Class and PFMP Periods
    const studentClass = classes.find(c =>
        c.id === allData.eleve_classe || c.name === allData.eleve_classe
    );

    const upcomingPeriod = studentClass?.pfmpPeriods?.find(p => {
        // Simple logic: Find first period ending in the future
        // Ideally should be sorted by date
        return new Date(p.endDate) >= new Date();
    });

    const handleNext = (data: Step4Data) => {
        setData(data);
        if (warnings.length > 0 && !confirm("Des avertissements subsistent (horaires/âge). Voulez-vous continuer ?")) {
            return;
        }
        console.log("Form complete", { ...allData, ...data });
        nextStep();
    };

    return (
        <StepWrapper<Step4Data>
            title="Le Stage (PFMP)"
            description="Dates, horaires et activités prévues."
            schema={stepSchema}
            onNext={handleNext}
            isNextDisabled={warnings.length > 0}
        >
            {(form) => {
                const today = new Date().toISOString().split('T')[0];
                const horaires = form.watch('stage_horaires');
                const dob = allData.eleve_date_naissance;
                const isDifferentAddress = form.watch('stage_adresse_differente');
                const stageLieu = form.watch('stage_lieu');

                // Clear address if checkbox is unchecked
                useEffect(() => {
                    if (!isDifferentAddress && stageLieu) {
                        form.setValue('stage_lieu', '');
                    }
                }, [isDifferentAddress, stageLieu, form]);

                // Auto-fill defaults if empty on mount
                useEffect(() => {
                    // 1. Auto-fill Dates from Calendar (if available and empty)
                    const currentStart = form.getValues('stage_date_debut');
                    const currentEnd = form.getValues('stage_date_fin');

                    if ((!currentStart || !currentEnd) && upcomingPeriod) {
                        if (!currentStart) form.setValue('stage_date_debut', upcomingPeriod.startDate);
                        if (!currentEnd) form.setValue('stage_date_fin', upcomingPeriod.endDate);
                    }

                    // 2. Auto-fill Hours
                    const current = form.getValues('stage_horaires');
                    // Only fill if completely empty/undefined to avoid overwriting
                    if (!current || Object.keys(current).length === 0) {
                        form.setValue('stage_horaires', {
                            'Lundi': { matin_debut: '08:00', matin_fin: '12:00', apres_midi_debut: '14:00', apres_midi_fin: '17:00' },
                            'Mardi': { matin_debut: '08:00', matin_fin: '12:00', apres_midi_debut: '14:00', apres_midi_fin: '17:00' },
                            'Mercredi': { matin_debut: '08:00', matin_fin: '12:00', apres_midi_debut: '14:00', apres_midi_fin: '17:00' },
                            'Jeudi': { matin_debut: '08:00', matin_fin: '12:00', apres_midi_debut: '14:00', apres_midi_fin: '17:00' },
                            'Vendredi': { matin_debut: '08:00', matin_fin: '12:00', apres_midi_debut: '14:00', apres_midi_fin: '17:00' },
                            'Samedi': { matin_debut: '', matin_fin: '', apres_midi_debut: '', apres_midi_fin: '' },
                        });
                    } else {
                        // Defensive fix: If Saturday has been wrongly pre-filled with default hours (e.g. from previous state), clear it.
                        const sam = current['Samedi'];
                        if (sam && (sam.matin_debut === '08:00' || sam.matin_debut === '8:00')) {
                            form.setValue('stage_horaires.Samedi', { matin_debut: '', matin_fin: '', apres_midi_debut: '', apres_midi_fin: '' });
                        }
                    }

                    // 3. Auto-fill Activities
                    const currentActivites = form.getValues('stage_activites');
                    if (!currentActivites) {
                        form.setValue('stage_activites', "Les activités proposées et les compétences sont celles du référentiels du diplôme.");
                    }
                }, [form]);

                // Calculate duration and validate logic (Render-pass logic for speed)
                let totalHours = 0;
                const newWarnings: string[] = [];

                // Determine age restrictions
                let nightStart = 22; // Default 16-18yo (22h-06h)
                let isUnder16 = false;

                if (dob) {
                    const birthDate = new Date(dob);
                    const today = new Date();
                    let age = today.getFullYear() - birthDate.getFullYear();
                    if (today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())) {
                        age--;
                    }

                    if (age < 16) {
                        nightStart = 20; // <16yo (20h-06h)
                        isUnder16 = true;
                    }
                }

                if (horaires) {
                    Object.entries(horaires).forEach(([day, slots]: [string, any]) => {
                        const calcDuration = (start?: string, end?: string) => {
                            if (!start || !end) return 0;
                            const [sh, sm] = start.split(':').map(Number);
                            const [eh, em] = end.split(':').map(Number);

                            // Check Night Work
                            if (sh < 6 || eh > nightStart || (eh === nightStart && em > 0) || sh > nightStart) {
                                newWarnings.push(`⚠️ ${day} : Travail de nuit interdit (${isUnder16 ? '20h' : '22h'}-06h)`);
                            }

                            const startMins = sh * 60 + sm;
                            const endMins = eh * 60 + em;
                            return Math.max(0, endMins - startMins);
                        };

                        totalHours += calcDuration(slots.matin_debut, slots.matin_fin);
                        totalHours += calcDuration(slots.apres_midi_debut, slots.apres_midi_fin);
                    });
                    totalHours = Math.round((totalHours / 60) * 10) / 10;
                }

                // Sync state and warnings via effect
                useEffect(() => {
                    // Update field value (avoid infinite loop by checking current value)
                    if (form.getValues('stage_duree_heures') !== totalHours) {
                        form.setValue('stage_duree_heures', totalHours, { shouldValidate: true });
                    }

                    // Max 35h check
                    const currentWarnings = [...newWarnings];
                    if (totalHours > 35) {
                        currentWarnings.push(`⚠️ Durée totale (${totalHours}h) dépasse la limite légale de 35h`);
                    }

                    if (JSON.stringify(currentWarnings) !== JSON.stringify(warnings)) {
                        setWarnings(currentWarnings);
                    }
                }, [totalHours, warnings, form]); // We use the derived totalHours here

                // Date Validation Visuals
                const dateDebut = form.watch('stage_date_debut');
                const dateFin = form.watch('stage_date_fin');

                // Check if dates match the official period (if one exists)
                const isOfficialPeriod = upcomingPeriod && dateDebut === upcomingPeriod.startDate && dateFin === upcomingPeriod.endDate;
                const isDerogation = upcomingPeriod && (!isOfficialPeriod);

                return (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        {/* PFMP Period Info Banner */}
                        {upcomingPeriod && (
                            <div className={`md:col-span-2 p-3 rounded-md border flex items-start space-x-3 text-sm ${isOfficialPeriod
                                ? 'bg-blue-50 border-blue-200 text-blue-800'
                                : 'bg-orange-50 border-orange-200 text-orange-800'
                                }`}>
                                {isOfficialPeriod ? (
                                    <Calendar className="w-5 h-5 mt-0.5 text-blue-600" />
                                ) : (
                                    <AlertTriangle className="w-5 h-5 mt-0.5 text-orange-600" />
                                )}
                                <div>
                                    <p className="font-bold">
                                        {isOfficialPeriod ? "Période de stage officielle" : "Attention : Dates hors calendrier officiel"}
                                    </p>
                                    <p>
                                        La période définie pour la classe <strong>{studentClass?.name}</strong> est du{' '}
                                        <strong>{format(parseISO(upcomingPeriod.startDate), 'dd/MM/yyyy')}</strong> au{' '}
                                        <strong>{format(parseISO(upcomingPeriod.endDate), 'dd/MM/yyyy')}</strong>.
                                    </p>
                                    {!isOfficialPeriod && (
                                        <p className="mt-1 text-xs italic">
                                            Vous pouvez modifier ces dates si une dérogation a été accordée. Une justification sera demandée lors de la signature.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Date de Début</label>
                            <input
                                {...form.register('stage_date_debut')}
                                type="date"
                                min={today}
                                className={cn(
                                    "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 sm:text-sm p-2 border text-gray-900 placeholder:text-gray-500",
                                    form.formState.errors.stage_date_debut && "border-red-500 focus:border-red-500 focus:ring-red-500"
                                )}
                            />
                            {form.formState.errors.stage_date_debut && <p className="text-red-500 text-xs mt-1">{form.formState.errors.stage_date_debut.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Date de Fin</label>
                            <input
                                {...form.register('stage_date_fin')}
                                type="date"
                                min={form.watch('stage_date_debut') || today}
                                className={cn(
                                    "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 sm:text-sm p-2 border text-gray-900 placeholder:text-gray-500",
                                    form.formState.errors.stage_date_fin && "border-red-500 focus:border-red-500 focus:ring-red-500"
                                )}
                            />
                            {form.formState.errors.stage_date_fin && <p className="text-red-500 text-xs mt-1">{form.formState.errors.stage_date_fin.message}</p>}
                        </div>

                        {/* Schedule Table */}
                        <div className="md:col-span-2 overflow-x-auto">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Horaires Hebdomadaires</label>
                            <table className="min-w-full divide-y divide-gray-200 text-sm border">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-3 py-2 text-left font-medium text-gray-500">Jour</th>
                                        <th className="px-3 py-2 text-left font-medium text-gray-500">Matin</th>
                                        <th className="px-3 py-2 text-left font-medium text-gray-500">Après-midi</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'].map((day) => (
                                        <tr key={day}>
                                            <td className="px-3 py-2 font-medium text-gray-900">{day}</td>
                                            <td className="px-3 py-2">
                                                <div className="flex items-center space-x-1">
                                                    <input
                                                        type="time"
                                                        {...form.register(`stage_horaires.${day}.matin_debut`)}
                                                        className="w-24 border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-500 sm:text-xs p-1 border text-gray-900"
                                                    />
                                                    <span className="text-gray-400">-</span>
                                                    <input
                                                        type="time"
                                                        {...form.register(`stage_horaires.${day}.matin_fin`)}
                                                        className="w-24 border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-500 sm:text-xs p-1 border text-gray-900"
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="flex items-center space-x-1">
                                                    <input
                                                        type="time"
                                                        {...form.register(`stage_horaires.${day}.apres_midi_debut`)}
                                                        className="w-24 border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-500 sm:text-xs p-1 border text-gray-900"
                                                    />
                                                    <span className="text-gray-400">-</span>
                                                    <input
                                                        type="time"
                                                        {...form.register(`stage_horaires.${day}.apres_midi_fin`)}
                                                        className="w-24 border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-500 sm:text-xs p-1 border text-gray-900"
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Warnings Block */}
                        {warnings.length > 0 && (
                            <div className="md:col-span-2 bg-yellow-50 border-l-4 border-yellow-400 p-4">
                                <div className="flex">
                                    <div className="ml-3">
                                        <h3 className="text-sm font-medium text-yellow-800">Attention (Réglementation)</h3>
                                        <div className="mt-2 text-sm text-yellow-700">
                                            <ul className="list-disc pl-5 space-y-1">
                                                {warnings.map((w, i) => <li key={i}>{w}</li>)}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Duration Field - Moved Below Table */}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Durée Totale Hebdomadaire (Heures)</label>
                            <div className="flex items-center space-x-4 mt-1">
                                <input
                                    {...form.register('stage_duree_heures', { valueAsNumber: true })}
                                    type="number"
                                    readOnly
                                    value={totalHours}
                                    className="block w-32 rounded-md border-gray-300 bg-gray-50 shadow-sm focus:border-gray-500 focus:ring-0 sm:text-sm p-2 border font-bold text-blue-900"
                                />
                                {/* Progress Bar */}
                                <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden border border-gray-300">
                                    <div
                                        className="h-full transition-all duration-500 ease-out flex items-center justify-end pr-2 text-[10px] font-bold text-white shadow-inner"
                                        style={{
                                            width: `${Math.min(100, (totalHours / 35) * 100)}%`,
                                            backgroundColor: totalHours >= 35 ? '#22c55e' : (totalHours >= 30 ? '#eab308' : '#ef4444')
                                        }}
                                    >
                                    </div>
                                </div>
                                <span className="text-xs font-medium text-gray-500 whitespace-nowrap">
                                    Objectif : 35h
                                </span>
                            </div>

                            {form.formState.errors.stage_duree_heures && <p className="text-red-500 text-xs mt-1">{form.formState.errors.stage_duree_heures.message}</p>}
                            <p className="text-xs text-gray-500 mt-1">Calculé automatiquement d'après les horaires saisis ci-dessus.</p>
                        </div>

                        <div className="md:col-span-2">
                            <div className="flex items-center mb-2">
                                <input
                                    type="checkbox"
                                    id="diffAddress"
                                    {...form.register('stage_adresse_differente')}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label htmlFor="diffAddress" className="ml-2 block text-sm font-medium text-gray-700">
                                    Le stage se déroulera sur un autre site (adresse différente de l'entreprise)
                                </label>
                            </div>

                            {isDifferentAddress && (
                                <div className="space-y-2 pl-6 border-l-2 border-gray-100">
                                    <label className="block text-sm font-medium text-gray-700">Adresse du lieu de stage</label>
                                    <div className="flex gap-2">
                                        <textarea
                                            {...form.register('stage_lieu')}
                                            rows={2}
                                            placeholder="Ex: Atelier, 12 Rue des Oliviers, 69002 Lyon"
                                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 sm:text-sm p-2 border placeholder:text-gray-500 text-gray-900"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const query = form.getValues('stage_lieu');
                                                if (query) {
                                                    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank');
                                                } else {
                                                    alert("Veuillez saisir une adresse avant de rechercher.");
                                                }
                                            }}
                                            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 border border-gray-300 flex items-center justify-center flex-shrink-0"
                                            title="Rechercher sur Google Maps"
                                        >
                                            <Search className="w-5 h-5" />
                                        </button>
                                    </div>
                                    {stageLieu && (
                                        <div className="mt-2 rounded-md overflow-hidden border border-gray-200 shadow-sm">
                                            <iframe
                                                width="100%"
                                                height="200"
                                                loading="lazy"
                                                allowFullScreen
                                                src={`https://maps.google.com/maps?q=${encodeURIComponent(stageLieu)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                                            ></iframe>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Activités et Compétences</label>
                            <textarea
                                {...form.register('stage_activites')}
                                rows={4}
                                placeholder="Détaillez les tâches confiées au stagiaire..."
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 sm:text-sm p-2 border placeholder:text-gray-500 text-gray-900"
                            />
                            {form.formState.errors.stage_activites && <p className="text-red-500 text-xs mt-1">{form.formState.errors.stage_activites.message}</p>}
                        </div>

                        <div className="md:col-span-2 mt-4 bg-gray-50 p-4 rounded-lg flex items-start space-x-3 text-sm text-gray-600">
                            <FileText className="w-5 h-5 mt-0.5 text-gray-400" />
                            <p>
                                En cliquant sur "Suivant", vous validerez les informations saisies pour générer la prévisualisation de la convention PFMP.
                            </p>
                        </div>
                    </div>
                );
            }}
        </StepWrapper>
    );
}
