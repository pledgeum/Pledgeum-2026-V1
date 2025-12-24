import React, { useState } from 'react';
import { X, Calendar, Clock, TriangleAlert } from 'lucide-react';
import { Convention } from '@/store/convention';
import { useConventionStore } from '@/store/convention';
import { sendNotification } from '@/lib/notification';
import { CustomCalendar } from './CustomCalendar';

interface AbsenceReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    convention: Convention;
    currentUserEmail: string;
    userRole: string; // Passed from parent
}

export function AbsenceReportModal({ isOpen, onClose, convention, currentUserEmail, userRole = '' }: AbsenceReportModalProps) {
    const { reportAbsence, updateAbsence } = useConventionStore();
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState<'LIST' | 'CREATE' | 'JUSTIFY'>('LIST');

    // For Justify Mode
    const [selectedAbsenceId, setSelectedAbsenceId] = useState<string | null>(null);
    const [justification, setJustification] = useState('');

    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        type: 'absence' as 'absence' | 'retard',
        duration: 7,
        reason: ''
    });

    if (!isOpen) return null;
    if (!convention) return null;

    const canCreate = !['student', 'parent'].includes(userRole);
    // Students/Parents (and everyone else) can justify
    const canJustify = true;

    const getDayDuration = (dateStr: string): number => {
        if (!convention.stage_horaires || !dateStr) return 7;
        const d = new Date(dateStr);
        const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
        const dayName = days[d.getDay()];
        const schedule = (convention.stage_horaires as any)[dayName];
        if (!schedule) return 0;
        const calc = (start?: string, end?: string) => {
            if (!start || !end) return 0;
            const [sh, sm] = start.split(':').map(Number);
            const [eh, em] = end.split(':').map(Number);
            return Math.max(0, (eh * 60 + em) - (sh * 60 + sm)) / 60;
        };
        return calc(schedule.matin_debut, schedule.matin_fin) + calc(schedule.apres_midi_debut, schedule.apres_midi_fin);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const finalDuration = formData.type === 'absence' ? getDayDuration(formData.date) : Number(formData.duration);
            await reportAbsence(convention.id, {
                date: formData.date,
                type: formData.type,
                duration: finalDuration,
                reason: formData.reason,
                reportedBy: currentUserEmail
            });
            alert("L'absence a été signalée.");
            setView('LIST'); // Return to list
            // Reset form
            setFormData({ ...formData, reason: '', duration: 7 });
        } catch (error) {
            console.error("Failed to report:", error);
            alert("Erreur lors du signalement.");
        } finally {
            setLoading(false);
        }
    };

    const handleJustifySubmmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedAbsenceId) return;
        setLoading(true);
        try {
            await updateAbsence(convention.id, selectedAbsenceId, justification);
            alert("Justification enregistrée.");
            setView('LIST');
            setSelectedAbsenceId(null);
            setJustification('');
        } catch (error) {
            console.error("Failed to justify:", error);
            alert("Erreur.");
        } finally {
            setLoading(false);
        }
    };

    // RENDER LIST VIEW
    if (view === 'LIST') {
        const absences = convention.absences || [];
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
                    <div className="flex justify-between items-center p-4 border-b bg-gray-50">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                            <TriangleAlert className="text-orange-500 w-5 h-5" />
                            Gestion des Absences
                        </h3>
                        <button onClick={onClose}><X className="w-5 h-5 text-gray-500" /></button>
                    </div>
                    <div className="p-4">
                        {absences.length === 0 ? (
                            <p className="text-center text-gray-500 py-4">Aucune absence signalée.</p>
                        ) : (
                            <div className="space-y-3 max-h-[300px] overflow-y-auto mb-4">
                                {absences.map((abs, idx) => (
                                    <div key={idx} className="border rounded-lg p-3 bg-gray-50 flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${abs.type === 'absence' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                    {abs.type}
                                                </span>
                                                <span className="text-sm font-medium">{new Date(abs.date).toLocaleDateString()}</span>
                                                <span className="text-xs text-gray-500">({abs.duration}h)</span>
                                            </div>
                                            <p className="text-sm mt-1 text-gray-700">
                                                {abs.reason ? (
                                                    <span className="text-gray-900">Motif: {abs.reason}</span>
                                                ) : (
                                                    <span className="text-red-500 italic">Non justifiée</span>
                                                )}
                                            </p>
                                        </div>
                                        {!abs.reason && canJustify && (
                                            <button
                                                onClick={() => {
                                                    setSelectedAbsenceId(abs.id);
                                                    setJustification('');
                                                    setView('JUSTIFY');
                                                }}
                                                className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                                            >
                                                Justifier
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex justify-end pt-2 border-t mt-2">
                            {canCreate ? (
                                <button
                                    onClick={() => setView('CREATE')}
                                    className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 text-sm font-medium"
                                >
                                    Signaler une nouvelle absence
                                </button>
                            ) : (
                                <p className="text-xs text-gray-500 italic mt-2">Seul le personnel encadrant peut signaler une nouvelle absence.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // RENDER JUSTIFY VIEW
    if (view === 'JUSTIFY') {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
                    <div className="flex justify-between items-center p-4 border-b bg-gray-50">
                        <h3 className="font-bold text-gray-900">Justifier une absence</h3>
                        <button onClick={() => setView('LIST')}><X className="w-5 h-5 text-gray-500" /></button>
                    </div>
                    <form onSubmit={handleJustifySubmmit} className="p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Motif / Justification</label>
                            <textarea
                                value={justification}
                                onChange={(e) => setJustification(e.target.value)}
                                rows={3}
                                required
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                                placeholder="Maladie, transports, etc..."
                            />
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                            <button type="button" onClick={() => setView('LIST')} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Annuler</button>
                            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Enregistrer</button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    // RENDER CREATE VIEW (Original Form)
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
                <div className="flex justify-between items-center p-4 border-b bg-gray-50">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                        <TriangleAlert className="text-orange-500 w-5 h-5" />
                        Signaler une Absence / Retard
                    </h3>
                    <button onClick={() => setView('LIST')}><X className="w-5 h-5 text-gray-500" /></button>
                </div>

                <form onSubmit={handleCreate} className="p-6 space-y-4">
                    <div className="bg-blue-50 p-3 rounded text-sm text-blue-800">
                        Élève : <strong>{convention.eleve_prenom} {convention.eleve_nom}</strong><br />
                        Une notification sera envoyée aux CPE, Parents (si mineur) et Enseignant Référent/Professeur Principal.
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Type</label>
                            <select
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                            >
                                <option value="absence">Absence</option>
                                <option value="retard">Retard</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Date</label>
                            <CustomCalendar
                                selectedDate={formData.date}
                                onSelectDate={(date) => setFormData({ ...formData, date })}
                                minDate={convention.stage_date_debut}
                                maxDate={convention.stage_date_fin}
                                schedule={convention.stage_horaires}
                            />
                        </div>
                    </div>

                    {formData.type === 'retard' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Durée du retard</label>
                            <select
                                value={formData.duration}
                                onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })}
                                required
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                            >
                                <option value="">Sélectionner la durée...</option>
                                {Array.from({ length: 32 }, (_, i) => (i + 1) * 0.25).map((val) => {
                                    const hours = Math.floor(val);
                                    const mins = (val % 1) * 60;
                                    const label = `${hours}h${mins === 0 ? '00' : mins}`;
                                    return (
                                        <option key={val} value={val}>
                                            {label}
                                        </option>
                                    );
                                })}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">Sélectionnez la durée du retard (par pas de 15 min)</p>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Motif / Justification (Optionnel)</label>
                        <textarea
                            value={formData.reason}
                            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                            rows={3}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                            placeholder="Maladie, transports, etc..."
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={() => setView('LIST')} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Annuler</button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 font-medium"
                        >
                            {loading ? 'Envoi...' : 'Signaler'}
                        </button>
                    </div>
                </form>
            </div >
        </div >
    );
}
