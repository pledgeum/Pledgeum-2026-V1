'use client';

import { useEffect, useState } from 'react';

import { z } from 'zod';
import { StepWrapper } from './StepWrapper';
import { conventionSchema } from '@/types/schema';
import { useWizardStore } from '@/store/wizard';
import { useSchoolStore, PfmpPeriod } from '@/store/school';
import { FileText, MapPin, Search, Calendar, AlertTriangle, Check } from 'lucide-react';
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
    is_out_of_period: true,
    selected_periods: true,
    selected_periods_labels: true,
    adjusted_periods: true,
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
        return new Date(p.endDate) >= new Date();
    });

    const [selectedPeriodIds, setSelectedPeriodIds] = useState<string[]>([]);

    const togglePeriod = (period: PfmpPeriod, form: any) => {
        const isSelected = selectedPeriodIds.includes(period.id);
        const newSelected = isSelected
            ? selectedPeriodIds.filter(id => id !== period.id)
            : [...selectedPeriodIds, period.id];

        setSelectedPeriodIds(newSelected);

        // Update adjusted_periods and global dates
        const currentAdjusted = form.getValues('adjusted_periods') || {};
        const newAdjusted = { ...currentAdjusted };

        if (!isSelected) {
            // Adding
            newAdjusted[period.id] = { start: period.startDate, end: period.endDate };
        } else {
            // Removing
            delete newAdjusted[period.id];
        }

        form.setValue('adjusted_periods', newAdjusted);

        if (newSelected.length > 0) {
            const adjustedValues = Object.values(newAdjusted) as { start: string, end: string }[];
            const starts = adjustedValues.map(v => new Date(v.start).getTime());
            const ends = adjustedValues.map(v => new Date(v.end).getTime());
            
            const minStart = new Date(Math.min(...starts));
            const maxEnd = new Date(Math.max(...ends));

            form.setValue('stage_date_debut', format(minStart, 'yyyy-MM-dd'));
            form.setValue('stage_date_fin', format(maxEnd, 'yyyy-MM-dd'));
        }
    };

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
                        if (!currentStart) {
                            const pStart = new Date(upcomingPeriod.startDate);
                            const now = new Date();
                            now.setHours(0, 0, 0, 0);
                            const defaultStart = pStart < now ? format(now, 'yyyy-MM-dd') : upcomingPeriod.startDate;
                            form.setValue('stage_date_debut', defaultStart);
                        }
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

                // Robust official period check: dates must be covered by at least one official period completely
                const isDateWithinOfficial = (dateStr: string) => {
                    if (!dateStr || !studentClass?.pfmpPeriods) return false;
                    const date = new Date(dateStr);
                    return studentClass.pfmpPeriods.some(p => {
                        const start = new Date(p.startDate);
                        const end = new Date(p.endDate);
                        return date >= start && date <= end;
                    });
                };

                const isOutOfPeriod = selectedPeriodIds.length === 0 && (!isDateWithinOfficial(dateDebut) || !isDateWithinOfficial(dateFin));

                // SYNC EFFECT
                const adjustedPeriods = form.watch('adjusted_periods');

                useEffect(() => {
                    if (adjustedPeriods && Object.keys(adjustedPeriods).length > 0) {
                        const values = Object.values(adjustedPeriods) as { start: string, end: string }[];
                        const validStarts = values.map(v => v.start).filter(Boolean).map(s => new Date(s).getTime());
                        const validEnds = values.map(v => v.end).filter(Boolean).map(e => new Date(e).getTime());

                        if (validStarts.length > 0 && validEnds.length > 0) {
                            const minStart = new Date(Math.min(...validStarts));
                            const maxEnd = new Date(Math.max(...validEnds));

                            const newStart = format(minStart, 'yyyy-MM-dd');
                            const newEnd = format(maxEnd, 'yyyy-MM-dd');

                            if (form.getValues('stage_date_debut') !== newStart) {
                                form.setValue('stage_date_debut', newStart);
                            }
                            if (form.getValues('stage_date_fin') !== newEnd) {
                                form.setValue('stage_date_fin', newEnd);
                            }
                        }
                    }
                }, [adjustedPeriods, form]);

                useEffect(() => {
                    if (form.getValues('is_out_of_period') !== isOutOfPeriod) {
                        form.setValue('is_out_of_period', isOutOfPeriod);
                    }
                    if (JSON.stringify(form.getValues('selected_periods')) !== JSON.stringify(selectedPeriodIds)) {
                        form.setValue('selected_periods', selectedPeriodIds);

                        // Also save labels for PDF
                        const selectedPeriods = studentClass?.pfmpPeriods?.filter(p => selectedPeriodIds.includes(p.id)) || [];
                        const labels = selectedPeriods.map(p => {
                            const adjusted = adjustedPeriods?.[p.id];
                            const start = adjusted?.start ? format(parseISO(adjusted.start), 'dd/MM/yyyy') : format(parseISO(p.startDate), 'dd/MM/yyyy');
                            const end = adjusted?.end ? format(parseISO(adjusted.end), 'dd/MM/yyyy') : format(parseISO(p.endDate), 'dd/MM/yyyy');
                            return `${p.label || 'Période'}: Du ${start} au ${end}`;
                        });
                        form.setValue('selected_periods_labels', labels);
                    }
                }, [isOutOfPeriod, selectedPeriodIds, form, studentClass, adjustedPeriods]);

                return (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        {/* PFMP Period Choice */}
                        {studentClass?.pfmpPeriods && studentClass.pfmpPeriods.length > 0 && (
                            <div className="md:col-span-2 space-y-4 mb-2">
                                <label className="block text-sm font-semibold text-indigo-900 flex items-center">
                                    <Calendar className="w-4 h-4 mr-2" />
                                    Périodes Officielles (Classe {studentClass.name})
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {studentClass.pfmpPeriods.map((period) => {
                                        const isSelected = selectedPeriodIds.includes(period.id);
                                        return (
                                            <div
                                                key={period.id}
                                                onClick={() => togglePeriod(period, form)}
                                                className={cn(
                                                    "cursor-pointer p-3 rounded-lg border transition-all flex items-center space-x-3",
                                                    isSelected
                                                        ? "bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500"
                                                        : "bg-white border-gray-200 hover:border-indigo-300"
                                                )}
                                            >
                                                <div className={cn(
                                                    "w-5 h-5 rounded border flex items-center justify-center",
                                                    isSelected ? "bg-indigo-600 border-indigo-600 text-white" : "border-gray-300"
                                                )}>
                                                    {isSelected && <Check className="w-3 h-3" />}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-xs font-bold text-indigo-900">{period.label || `Période ${period.id.slice(-4).toUpperCase()}`}</p>
                                                    <p className="text-xs text-indigo-700">
                                                        {format(parseISO(period.startDate), 'dd MMM')} → {format(parseISO(period.endDate), 'dd MMM yyyy')}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}


                        {/* Multi-Period Date Adjustment */}
                        {selectedPeriodIds.length > 0 ? (
                            <div className="md:col-span-2 space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <h3 className="text-sm font-bold text-indigo-900 flex items-center">
                                    <Calendar className="w-4 h-4 mr-2" />
                                    Ajustement des dates par période
                                </h3>
                                <div className="space-y-3">
                                    {selectedPeriodIds.map((id) => {
                                        const period = studentClass?.pfmpPeriods?.find(p => p.id === id);
                                        if (!period) return null;
                                        return (
                                            <div key={id} className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-white rounded-md border border-gray-100 shadow-sm relative">
                                                <div className="sm:col-span-2">
                                                    <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">
                                                        {period.label || `Période ${period.id.slice(-4).toUpperCase()}`}
                                                    </p>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-medium text-gray-500 uppercase">Date de Début</label>
                                                    <input
                                                        type="date"
                                                        {...form.register(`adjusted_periods.${id}.start`)}
                                                        onChange={(e) => {
                                                            form.setValue(`adjusted_periods.${id}.start`, e.target.value);
                                                            // Trigger global sync (Effect will handle this if we watch adjusted_periods)
                                                        }}
                                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-xs p-1.5 border"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-medium text-gray-500 uppercase">Date de Fin</label>
                                                    <input
                                                        type="date"
                                                        {...form.register(`adjusted_periods.${id}.end`)}
                                                        onChange={(e) => {
                                                            form.setValue(`adjusted_periods.${id}.end`, e.target.value);
                                                        }}
                                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-xs p-1.5 border"
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <p className="text-[10px] text-gray-500 italic">
                                    Les dates globales de la convention seront automatiquement ajustées selon vos saisies ci-dessus.
                                </p>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Date de Début (Dérogatoire)</label>
                                    <input
                                        {...form.register('stage_date_debut')}
                                        type="date"
                                        min={today}
                                        className={cn(
                                            "mt-1 block w-full rounded-md border-gray-400 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 sm:text-sm p-2 border text-gray-900 placeholder:text-gray-500 disabled:opacity-100 disabled:text-gray-900",
                                            form.formState.errors.stage_date_debut && "border-red-500 focus:border-red-500 focus:ring-red-500"
                                        )}
                                    />
                                    {form.formState.errors.stage_date_debut && <p className="text-red-500 text-xs mt-1">{form.formState.errors.stage_date_debut.message}</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Date de Fin (Dérogatoire)</label>
                                    <input
                                        {...form.register('stage_date_fin')}
                                        type="date"
                                        min={form.watch('stage_date_debut') || today}
                                        className={cn(
                                            "mt-1 block w-full rounded-md border-gray-400 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 sm:text-sm p-2 border text-gray-900 placeholder:text-gray-500 disabled:opacity-100 disabled:text-gray-900",
                                            form.formState.errors.stage_date_fin && "border-red-500 focus:border-red-500 focus:ring-red-500"
                                        )}
                                    />
                                    {form.formState.errors.stage_date_fin && <p className="text-red-500 text-xs mt-1">{form.formState.errors.stage_date_fin.message}</p>}
                                </div>
                            </>
                        )}

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
                                                        className="w-24 border-gray-400 rounded-md shadow-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-500 sm:text-xs p-1 border text-gray-900 disabled:opacity-100 disabled:text-gray-900"
                                                    />
                                                    <span className="text-gray-400">-</span>
                                                    <input
                                                        type="time"
                                                        {...form.register(`stage_horaires.${day}.matin_fin`)}
                                                        className="w-24 border-gray-400 rounded-md shadow-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-500 sm:text-xs p-1 border text-gray-900 disabled:opacity-100 disabled:text-gray-900"
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="flex items-center space-x-1">
                                                    <input
                                                        type="time"
                                                        {...form.register(`stage_horaires.${day}.apres_midi_debut`)}
                                                        className="w-24 border-gray-400 rounded-md shadow-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-500 sm:text-xs p-1 border text-gray-900 disabled:opacity-100 disabled:text-gray-900"
                                                    />
                                                    <span className="text-gray-400">-</span>
                                                    <input
                                                        type="time"
                                                        {...form.register(`stage_horaires.${day}.apres_midi_fin`)}
                                                        className="w-24 border-gray-400 rounded-md shadow-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-500 sm:text-xs p-1 border text-gray-900 disabled:opacity-100 disabled:text-gray-900"
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
                                    className="block w-32 rounded-md border-gray-400 bg-gray-50 shadow-sm focus:border-gray-500 focus:ring-0 sm:text-sm p-2 border font-bold text-gray-900 disabled:opacity-100 disabled:text-gray-900"
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
                                            className="block w-full rounded-md border-gray-400 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 sm:text-sm p-2 border placeholder:text-gray-500 text-gray-900 disabled:opacity-100 disabled:text-gray-900"
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
                                className="mt-1 block w-full rounded-md border-gray-400 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 sm:text-sm p-2 border placeholder:text-gray-500 text-gray-900 disabled:opacity-100 disabled:text-gray-900"
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
