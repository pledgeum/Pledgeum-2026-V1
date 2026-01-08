'use client';

import { useState, useMemo } from 'react';
import { X, Check, AlertTriangle, Users } from 'lucide-react';
import { Student } from '@/store/school';

interface StructureImportReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: { className: string; students: Omit<Student, 'id'>[] }[];
    onConfirm: (selectedClasses: { className: string; students: Omit<Student, 'id'>[] }[]) => void;
}

export function StructureImportReviewModal({ isOpen, onClose, data, onConfirm }: StructureImportReviewModalProps) {
    const [selectedIndices, setSelectedIndices] = useState<number[]>(data.map((_, i) => i)); // Default select all

    const totalStudents = useMemo(() => {
        return data.reduce((acc, curr, idx) => selectedIndices.includes(idx) ? acc + curr.students.length : acc, 0);
    }, [data, selectedIndices]);

    const toggleSelection = (index: number) => {
        setSelectedIndices(prev =>
            prev.includes(index)
                ? prev.filter(i => i !== index)
                : [...prev, index]
        );
    };

    const toggleAll = () => {
        if (selectedIndices.length === data.length) {
            setSelectedIndices([]);
        } else {
            setSelectedIndices(data.map((_, i) => i));
        }
    };

    const handleConfirm = () => {
        const selectedData = data.filter((_, i) => selectedIndices.includes(i));
        onConfirm(selectedData);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full flex flex-col max-h-[85vh]">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-blue-900 text-white rounded-t-xl">
                    <h3 className="text-lg font-bold flex items-center">
                        <Users className="w-5 h-5 mr-2" />
                        Aperçu de l'importation Pronote
                    </h3>
                    <button onClick={onClose} className="text-blue-200 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                    <div className="mb-4 flex items-center justify-between">
                        <p className="text-sm text-gray-600">
                            <strong>{data.length}</strong> classes détectées, total <strong>{totalStudents}</strong> élèves sélectionnés.
                        </p>
                        <button
                            onClick={toggleAll}
                            className="text-xs font-medium text-blue-600 hover:underline"
                        >
                            {selectedIndices.length === data.length ? "Tout désélectionner" : "Tout sélectionner"}
                        </button>
                    </div>

                    <div className="space-y-3">
                        {data.map((group, index) => {
                            const isSelected = selectedIndices.includes(index);
                            return (
                                <div
                                    key={index}
                                    className={`bg-white border rounded-lg p-4 transition-colors cursor-pointer ${isSelected ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200 hover:border-blue-300'}`}
                                    onClick={() => toggleSelection(index)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center">
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center mr-3 transition-colors ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'}`}>
                                                {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-gray-900">{group.className}</h4>
                                                <p className="text-xs text-gray-500">{group.students.length} élèves</p>
                                            </div>
                                        </div>
                                        {/* Future improvement: Show warning if class exists */}
                                    </div>

                                    {/* Preview of first few students */}
                                    <div className="mt-3 pl-8 text-xs text-gray-500 text-ellipsis overflow-hidden whitespace-nowrap">
                                        {group.students.slice(0, 3).map(s => `${s.lastName} ${s.firstName}`).join(', ')}
                                        {group.students.length > 3 && `, +${group.students.length - 3} autres...`}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="p-6 border-t border-gray-100 bg-white rounded-b-xl flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={selectedIndices.length === 0}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Confirmer l'importation ({selectedIndices.length} classes)
                    </button>
                </div>
            </div>
        </div>
    );
}
