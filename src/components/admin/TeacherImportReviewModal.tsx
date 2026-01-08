import React, { useState, useMemo } from 'react';
import { X, Check, AlertTriangle, Users } from 'lucide-react';
import { Teacher } from '@/store/school';

interface TeacherImportReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: { teacher: Omit<Teacher, 'id'>, classes: string[] }[];
    onConfirm: (data: { teacher: Omit<Teacher, 'id'>, classes: string[] }[]) => void;
}

export function TeacherImportReviewModal({ isOpen, onClose, data, onConfirm }: TeacherImportReviewModalProps) {
    const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set(data.map((_, i) => i)));

    const toggleSelection = (index: number) => {
        const newSet = new Set(selectedIndices);
        if (newSet.has(index)) {
            newSet.delete(index);
        } else {
            newSet.add(index);
        }
        setSelectedIndices(newSet);
    };

    const toggleAll = () => {
        if (selectedIndices.size === data.length) {
            setSelectedIndices(new Set());
        } else {
            setSelectedIndices(new Set(data.map((_, i) => i)));
        }
    };

    const handleConfirm = () => {
        const selectedData = data.filter((_, i) => selectedIndices.has(i));
        onConfirm(selectedData);
        onClose();
    };

    const stats = useMemo(() => {
        return {
            totalTeachers: data.length,
            selectedTeachers: selectedIndices.size,
            totalClassesAffected: new Set(data.flatMap(d => d.classes)).size
        };
    }, [data, selectedIndices]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-blue-900 text-white rounded-t-xl">
                    <div className="flex items-center space-x-3">
                        <Users className="w-6 h-6" />
                        <div>
                            <h3 className="text-xl font-bold">Confirmer l'import des Professeurs</h3>
                            <p className="text-xs text-blue-200">Vérifiez les données extraites du fichier Pronote</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-blue-200 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Stats Header */}
                <div className="bg-blue-50 px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-gray-200">
                    <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                        <p className="text-xs text-blue-500 uppercase font-bold">Professeurs détectés</p>
                        <p className="text-2xl font-bold text-blue-900">{stats.totalTeachers}</p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                        <p className="text-xs text-green-500 uppercase font-bold">À importer</p>
                        <p className="text-2xl font-bold text-green-900">{stats.selectedTeachers}</p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                        <p className="text-xs text-orange-500 uppercase font-bold">Classes concernées</p>
                        <p className="text-2xl font-bold text-orange-900">{stats.totalClassesAffected}</p>
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="font-bold text-gray-700">Détail par enseignant</h4>
                        <button
                            onClick={toggleAll}
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                        >
                            {selectedIndices.size === data.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                        </button>
                    </div>

                    <div className="space-y-3">
                        {data.map((item, index) => {
                            const isSelected = selectedIndices.has(index);
                            return (
                                <div
                                    key={index}
                                    className={`bg-white rounded-lg border shadow-sm transition-all ${isSelected ? 'border-blue-300 ring-1 ring-blue-100' : 'border-gray-200 opacity-60'}`}
                                >
                                    <div className="p-4 flex items-center gap-4">
                                        <div className="flex-shrink-0">
                                            <button
                                                onClick={() => toggleSelection(index)}
                                                className={`w-6 h-6 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300 text-transparent hover:border-blue-400'}`}
                                            >
                                                <Check className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h5 className="font-bold text-gray-900 truncate">
                                                        {item.teacher.lastName} {item.teacher.firstName}
                                                    </h5>
                                                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full border border-gray-200 font-mono">
                                                        {item.teacher.birthDate || 'Sans date de naiss.'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {item.classes.slice(0, 5).map((cls, i) => (
                                                    <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                                                        {cls}
                                                    </span>
                                                ))}
                                                {item.classes.length > 5 && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                                        +{item.classes.length - 5} autres
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 bg-white rounded-b-xl flex justify-between items-center">
                    <div className="text-xs text-gray-500 italic max-w-md">
                        * Les enseignants seront créés s'ils n'existent pas, et ajoutés aux classes listées.
                        Les doublons (Nom + Prénom + Date Naissance) seront évités.
                    </div>
                    <div className="flex space-x-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                        >
                            Annuler
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={selectedIndices.size === 0}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        >
                            <Check className="w-4 h-4 mr-2" />
                            Confirmer l'import ({selectedIndices.size})
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
