import { useState, useMemo } from 'react';
import { useSchoolStore, ClassDefinition, PfmpPeriod } from '@/store/school';
import { format, eachDayOfInterval, startOfMonth, endOfMonth, getDay, isSameDay, isWithinInterval, addMonths, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar, Trash2, Plus, AlertCircle, Save } from 'lucide-react';
import { toast } from 'sonner';

export function ClassCalendarManager() {
    const { classes, addPfmpPeriod, updatePfmpPeriod, deletePfmpPeriod } = useSchoolStore();
    const [selectedClassId, setSelectedClassId] = useState<string>('');
    const [editingPeriod, setEditingPeriod] = useState<Partial<PfmpPeriod> | null>(null);

    const selectedClass = useMemo(() => classes.find(c => c.id === selectedClassId), [classes, selectedClassId]);

    // Defaults for new period
    const handleAddNew = () => {
        if (!selectedClass) return;
        setEditingPeriod({
            label: `PFMP ${(selectedClass.pfmpPeriods || []).length + 1}`,
            startDate: '',
            endDate: '',
            classId: selectedClass.id
        });
    };

    const handleSave = () => {
        if (!editingPeriod || !editingPeriod.label || !editingPeriod.startDate || !editingPeriod.endDate || !selectedClass) {
            toast.error("Veuillez remplir tous les champs");
            return;
        }

        if (new Date(editingPeriod.startDate) > new Date(editingPeriod.endDate)) {
            toast.error("La date de début doit être avant la date de fin");
            return;
        }

        if (editingPeriod.id) {
            updatePfmpPeriod(editingPeriod.id, editingPeriod);
            toast.success("Période mise à jour");
        } else {
            addPfmpPeriod(editingPeriod as Omit<PfmpPeriod, 'id'>);
            toast.success("Période ajoutée");
        }
        setEditingPeriod(null);
    };

    // School Year: Sept 2025 - Aug 2026 (or dynamic based on current date)
    // For MVP, let's assume current school year based on today.
    // If today is Jan 2026, school year is Sept 2025 - Aug 2026.
    const schoolYearStart = useMemo(() => {
        const today = new Date();
        const year = today.getMonth() >= 8 ? today.getFullYear() : today.getFullYear() - 1; // Sept is month 8 (0-indexed)
        return new Date(year, 8, 1); // Sept 1st
    }, []);

    const months = useMemo(() => {
        return Array.from({ length: 12 }).map((_, i) => addMonths(schoolYearStart, i));
    }, [schoolYearStart]);

    return (
        <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-6 text-gray-800">
                <Calendar className="w-6 h-6 text-blue-600" />
                Calendrier Directeur des PFMP
            </h2>

            {/* Class Selector */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Sélectionner une classe</label>
                <select
                    value={selectedClassId}
                    onChange={(e) => {
                        setSelectedClassId(e.target.value);
                        setEditingPeriod(null);
                    }}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                >
                    <option value="">-- Choisir une classe --</option>
                    {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                            {cls.name} - {cls.label || 'Sans libellé'}
                        </option>
                    ))}
                </select>
            </div>

            {selectedClass && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* LEFT COL: List & Form */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-semibold text-gray-900">Périodes Définies</h3>
                                <button
                                    onClick={handleAddNew}
                                    className="p-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                                    title="Ajouter une période"
                                >
                                    <Plus className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Editing Form */}
                            {editingPeriod && (
                                <div className="mb-4 bg-white p-3 rounded shadow-sm border border-blue-200 animate-in fade-in zoom-in-95">
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 uppercase">Libellé</label>
                                            <input
                                                type="text"
                                                value={editingPeriod.label}
                                                onChange={(e) => setEditingPeriod({ ...editingPeriod, label: e.target.value })}
                                                className="w-full text-sm border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="Ex: PFMP 1"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 uppercase">Début</label>
                                                <input
                                                    type="date"
                                                    value={editingPeriod.startDate}
                                                    onChange={(e) => setEditingPeriod({ ...editingPeriod, startDate: e.target.value })}
                                                    className="w-full text-sm border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 uppercase">Fin</label>
                                                <input
                                                    type="date"
                                                    value={editingPeriod.endDate}
                                                    onChange={(e) => setEditingPeriod({ ...editingPeriod, endDate: e.target.value })}
                                                    className="w-full text-sm border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex justify-end gap-2 pt-2">
                                            <button onClick={() => setEditingPeriod(null)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">Annuler</button>
                                            <button onClick={handleSave} className="flex items-center text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">
                                                <Save className="w-3 h-3 mr-1" />
                                                Enregistrer
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* List */}
                            <div className="space-y-2">
                                {selectedClass.pfmpPeriods && selectedClass.pfmpPeriods.length > 0 ? (
                                    selectedClass.pfmpPeriods
                                        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                                        .map((period) => (
                                            <div key={period.id} className="bg-white p-3 rounded border border-gray-200 flex justify-between items-center group hover:border-blue-300 transition-colors">
                                                <div onClick={() => setEditingPeriod(period)} className="cursor-pointer flex-1">
                                                    <p className="font-bold text-sm text-gray-800">{period.label}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {format(parseISO(period.startDate), 'dd/MM/yyyy')} → {format(parseISO(period.endDate), 'dd/MM/yyyy')}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => deletePfmpPeriod(period.id)}
                                                    className="text-gray-400 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))
                                ) : (
                                    <p className="text-sm text-gray-500 italic text-center py-4">Aucune période définie.</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COL: Year Visualization */}
                    <div className="lg:col-span-2">
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                            <h3 className="font-semibold text-gray-900 mb-4 text-center">
                                Année Scolaire {format(schoolYearStart, 'yyyy')} - {format(addMonths(schoolYearStart, 12), 'yyyy')}
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                {months.map((monthStart) => (
                                    <MiniCalendar
                                        key={monthStart.toString()}
                                        monthStart={monthStart}
                                        periods={selectedClass.pfmpPeriods || []}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function MiniCalendar({ monthStart, periods }: { monthStart: Date, periods: PfmpPeriod[] }) {
    const days = eachDayOfInterval({
        start: startOfMonth(monthStart),
        end: endOfMonth(monthStart)
    });

    const startDay = getDay(startOfMonth(monthStart)); // 0 = Sun, 1 = Mon, ...
    // Adjust for French week (Mon = 0 in grid?) No, standard grid usually Sun or Mon first.
    // Let's use Mon first.
    const colStart = startDay === 0 ? 6 : startDay - 1; // Mon=0, Tue=1, ..., Sun=6

    return (
        <div className="text-xs">
            <h4 className="font-bold text-center mb-2 capitalize text-gray-700">
                {format(monthStart, 'MMMM', { locale: fr })}
            </h4>
            <div className="grid grid-cols-7 gap-0.5 text-center text-gray-400 mb-1">
                <span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span>
            </div>
            <div className="grid grid-cols-7 gap-0.5">
                {Array.from({ length: colStart }).map((_, i) => <div key={`empty-${i}`} />)}
                {days.map((day) => {
                    const isPeriod = periods.some(p =>
                        isWithinInterval(day, {
                            start: parseISO(p.startDate),
                            end: parseISO(p.endDate)
                        })
                    );

                    return (
                        <div
                            key={day.toISOString()}
                            className={`
                                h-6 flex items-center justify-center rounded-sm
                                ${isPeriod ? 'bg-blue-600 text-white font-bold' : 'text-gray-700 hover:bg-gray-100'}
                            `}
                        >
                            {format(day, 'd')}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
