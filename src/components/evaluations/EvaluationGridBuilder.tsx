'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, GripVertical, Settings2, X, Loader2, AlignLeft, Hash, CheckSquare, ChevronDown } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useUserStore } from '@/store/user';
import { db } from '@/lib/firebase';
import { doc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

type RowType = 'text' | 'number' | 'checkbox' | 'checkbox_single' | 'checkbox_multi';

interface Row {
    id: number;
    cells: string[];
    type: RowType;
}
interface EvaluationGridBuilderProps {
    initialData?: any;
    templateId?: string;
    mode?: 'create' | 'edit';
}

export const EvaluationGridBuilder = ({ initialData, templateId, mode = 'create' }: EvaluationGridBuilderProps) => {
    const { user } = useAuth();
    const { profileData, role } = useUserStore();
    const router = useRouter();

    useEffect(() => {
        if (role && role !== 'teacher' && role !== 'at_ddfpt') {
            router.push('/dashboard');
            toast.error("Accès non autorisé pour créer des évaluations.");
        }
    }, [role, user, router]);

    const [isSaving, setIsSaving] = useState(false);

    const [title, setTitle] = useState(initialData?.title || "Nouvelle Évaluation");
    const [subtitle, setSubtitle] = useState(initialData?.subtitle || "");
    const [headers, setHeaders] = useState<string[]>(initialData?.structure?.headers || ["Critère", "Note /20", "Observation"]);
    const [rows, setRows] = useState<Row[]>(initialData?.structure?.rows || [{ id: Date.now(), cells: ["", "", ""], type: 'text' }]);

    // Synthesis State
    const [synthesisEnabled, setSynthesisEnabled] = useState(initialData?.synthesis?.enabled || false);
    const [synthesisTitle, setSynthesisTitle] = useState(initialData?.synthesis?.title || "Synthèse");

    // Handlers for Columns
    const addColumn = () => {
        setHeaders([...headers, "Nouvelle Colonne"]);
        setRows(rows.map(row => ({ ...row, cells: [...row.cells, ""] })));
    };

    const removeColumn = (index: number) => {
        if (headers.length <= 1) return; // Prevent removing last column
        const newHeaders = headers.filter((_, i) => i !== index);
        setHeaders(newHeaders);
        setRows(rows.map(row => ({
            ...row,
            cells: row.cells.filter((_, i) => i !== index)
        })));
    };

    const updateHeader = (index: number, value: string) => {
        const newHeaders = [...headers];
        newHeaders[index] = value;
        setHeaders(newHeaders);
    };

    // Handlers for Rows
    const addRow = () => {
        const newRow: Row = {
            id: Date.now(),
            cells: new Array(headers.length).fill(""),
            type: 'text'
        };
        setRows([...rows, newRow]);
    };

    const removeRow = (id: number) => {
        setRows(rows.filter(row => row.id !== id));
    };

    const updateRowType = (id: number, type: RowType) => {
        setRows(rows.map(row => row.id === id ? { ...row, type } : row));
    };

    const updateCell = (rowId: number, colIndex: number, value: string) => {
        setRows(rows.map(row => {
            if (row.id === rowId) {
                const newCells = [...row.cells];
                newCells[colIndex] = value;
                return { ...row, cells: newCells };
            }
            return row;
        }));
    };

    const handleSave = async () => {
        if (!user) {
            toast.error("Vous devez être connecté pour sauvegarder.");
            return;
        }

        if (!title.trim()) {
            toast.error("Le titre de l'évaluation est requis.");
            return;
        }

        setIsSaving(true);

        try {
            const payload = {
                title,
                subtitle,
                structure: {
                    headers,
                    rows
                },
                synthesis: synthesisEnabled ? {
                    enabled: true,
                    title: synthesisTitle
                } : null,
                updatedAt: serverTimestamp(),
                // Only set these on create, but merging usually safe
                ...(mode === 'create' ? {
                    authorId: user.uid,
                    schoolId: profileData?.ecole_id || null,
                    createdAt: serverTimestamp()
                } : {})
            };

            if (mode === 'edit' && templateId) {
                await updateDoc(doc(db, "evaluation_templates", templateId), payload);
                toast.success("Modèle mis à jour avec succès !");
            } else {
                await addDoc(collection(db, "evaluation_templates"), payload);
                toast.success("Modèle enregistré avec succès !");
            }

            router.push('/dashboard/evaluations');

        } catch (error) {
            console.error("Error saving evaluation template:", error);
            toast.error("Erreur lors de la sauvegarde du modèle.");
        } finally {
            setIsSaving(false);
        }
    };

    const getTypeIcon = (type: RowType) => {
        switch (type) {
            case 'text': return <AlignLeft className="w-4 h-4" />;
            case 'number': return <Hash className="w-4 h-4" />;
            case 'checkbox':
            case 'checkbox_multi':
                return <CheckSquare className="w-4 h-4" />;
            case 'checkbox_single':
                return <CheckSquare className="w-4 h-4 border-2 border-primary rounded-full" />; // Visual hint for radio
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-8">

            {/* Header Section */}
            <div className="flex items-start space-x-4">
                <button
                    onClick={() => router.push('/dashboard/evaluations')}
                    className="mt-1 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Retour à la liste"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                </button>
                <div className="space-y-4 max-w-2xl flex-1">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Titre de l'évaluation</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full text-xl font-bold text-gray-900 border-0 border-b-2 border-transparent hover:border-gray-200 focus:border-blue-500 focus:ring-0 px-0 transition-colors placeholder-gray-400"
                            placeholder="Ex: Évaluation PFMP Stage 1"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Sous-titre / Description</label>
                        <input
                            type="text"
                            value={subtitle}
                            onChange={(e) => setSubtitle(e.target.value)}
                            className="w-full text-base text-gray-600 border-0 border-b border-transparent hover:border-gray-200 focus:border-blue-500 focus:ring-0 px-0 transition-colors placeholder-gray-400"
                            placeholder="Ajouter une description..."
                        />
                    </div>
                </div>
            </div>

            {/* Grid Builder */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px]">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="w-24 py-3 px-4 text-center">
                                    <span className="sr-only">Actions</span>
                                </th>
                                {headers.map((header, index) => (
                                    <th key={index} className="py-3 px-4 min-w-[200px] group relative border-r border-gray-100 last:border-r-0">
                                        <div className="flex items-center space-x-2 px-2">
                                            <input
                                                type="text"
                                                value={header}
                                                onChange={(e) => updateHeader(index, e.target.value)}
                                                className="w-full bg-white text-sm font-semibold text-gray-700 border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-black/20 focus:border-black placeholder-gray-400 hover:border-gray-400 transition-colors"
                                                placeholder="Nom colonne"
                                            />
                                            {headers.length > 1 && (
                                                <button
                                                    onClick={() => removeColumn(index)}
                                                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                                                    title="Supprimer la colonne"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                    </th>
                                ))}
                                <th className="w-16 py-3 px-4 bg-gray-50">
                                    <button
                                        onClick={addColumn}
                                        className="flex flex-col items-center justify-center w-full h-full text-gray-400 hover:text-blue-600 transition-colors"
                                        title="Ajouter une colonne"
                                    >
                                        <Plus className="w-5 h-5" />
                                    </button>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {rows.map((row) => (
                                <tr key={row.id} className="group hover:bg-gray-50/50 transition-colors">
                                    {/* Row Actions + Type Selector */}
                                    <td className="py-3 px-4">
                                        <div className="flex items-center justify-center space-x-2">
                                            <button
                                                onClick={() => removeRow(row.id)}
                                                className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                                title="Supprimer la ligne"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>

                                            {/* Type Selector Dropdown */}
                                            <div className="relative group/type hover:z-50">
                                                <button
                                                    className="flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-gray-300 hover:border-black hover:bg-gray-50 text-gray-700 hover:text-black transition-all shadow-sm"
                                                    title="Changer le type de saisie pour cette ligne"
                                                >
                                                    {getTypeIcon(row.type)}
                                                    <ChevronDown className="w-3 h-3 text-gray-500 group-hover/type:text-black" />
                                                </button>
                                                <div className="absolute left-0 top-full -mt-2 w-56 bg-white rounded-xl shadow-xl border border-black py-2 hidden group-hover/type:block z-50 animate-in fade-in zoom-in-95 duration-200">
                                                    <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-50 mb-1">
                                                        Type de réponse
                                                    </div>
                                                    <button
                                                        onClick={() => updateRowType(row.id, 'text')}
                                                        className={`w-full flex items-center px-4 py-3 text-sm text-left hover:bg-blue-50 hover:text-blue-600 transition-colors ${row.type === 'text' ? 'text-blue-600 bg-blue-50 font-medium' : 'text-gray-700'}`}
                                                    >
                                                        <AlignLeft className="w-4 h-4 mr-3" />
                                                        <div>
                                                            <span className="block">Texte libre</span>
                                                            <span className="block text-xs text-gray-400 font-normal mt-0.5">Réponse ouverte</span>
                                                        </div>
                                                    </button>
                                                    <button
                                                        onClick={() => updateRowType(row.id, 'number')}
                                                        className={`w-full flex items-center px-4 py-3 text-sm text-left hover:bg-blue-50 hover:text-blue-600 transition-colors ${row.type === 'number' ? 'text-blue-600 bg-blue-50 font-medium' : 'text-gray-700'}`}
                                                    >
                                                        <Hash className="w-4 h-4 mr-3" />
                                                        <div>
                                                            <span className="block">Nombre</span>
                                                            <span className="block text-xs text-gray-400 font-normal mt-0.5">Note sur 20, etc.</span>
                                                        </div>
                                                    </button>
                                                    <div className="border-t border-gray-100 my-1"></div>
                                                    <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-50 mb-1 mt-1">
                                                        Choix
                                                    </div>
                                                    <button
                                                        onClick={() => updateRowType(row.id, 'checkbox_multi')}
                                                        className={`w-full flex items-center px-4 py-3 text-sm text-left hover:bg-blue-50 hover:text-blue-600 transition-colors ${row.type === 'checkbox' || row.type === 'checkbox_multi' ? 'text-blue-600 bg-blue-50 font-medium' : 'text-gray-700'}`}
                                                    >
                                                        <CheckSquare className="w-4 h-4 mr-3" />
                                                        <div>
                                                            <span className="block">Choix Multiple</span>
                                                            <span className="block text-xs text-gray-400 font-normal mt-0.5">Plusieurs cases possibles</span>
                                                        </div>
                                                    </button>
                                                    <button
                                                        onClick={() => updateRowType(row.id, 'checkbox_single')}
                                                        className={`w-full flex items-center px-4 py-3 text-sm text-left hover:bg-blue-50 hover:text-blue-600 transition-colors ${row.type === 'checkbox_single' ? 'text-blue-600 bg-blue-50 font-medium' : 'text-gray-700'}`}
                                                    >
                                                        <div className="w-4 h-4 rounded-full border border-current mr-3 flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-current"></div></div>
                                                        <div>
                                                            <span className="block">Choix Unique</span>
                                                            <span className="block text-xs text-gray-400 font-normal mt-0.5">Une seule réponse possible</span>
                                                        </div>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    {row.cells.map((cell, colIndex) => (
                                        <td key={colIndex} className="p-0 border-r border-gray-100 last:border-r-0 relative">
                                            {/* Column 0 is ALWAYS the Label/Criterion -> Always Textarea */}
                                            {colIndex === 0 ? (
                                                <div className="p-2 h-full">
                                                    <textarea
                                                        value={cell}
                                                        onChange={(e) => updateCell(row.id, colIndex, e.target.value)}
                                                        rows={1}
                                                        className="w-full h-full min-h-[50px] py-2 px-3 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-inset focus:ring-black bg-white text-sm text-gray-800 placeholder-gray-400 font-medium overflow-hidden hover:border-gray-400 transition-colors"
                                                        placeholder="Critère..."
                                                        style={{ fieldSizing: "content" } as any}
                                                    />
                                                </div>
                                            ) : (
                                                // Other columns depend on row type
                                                <>
                                                    {row.type === 'text' && (
                                                        <div className="p-2 h-full">
                                                            <textarea
                                                                value={cell}
                                                                onChange={(e) => updateCell(row.id, colIndex, e.target.value)}
                                                                rows={1}
                                                                className="w-full h-full min-h-[50px] py-2 px-3 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-inset focus:ring-black bg-white text-sm text-gray-600 placeholder-gray-300 hover:border-gray-400 transition-colors"
                                                                placeholder="Réponse..."
                                                                style={{ fieldSizing: "content" } as any}
                                                            />
                                                        </div>
                                                    )}

                                                    {row.type === 'number' && (
                                                        <div className="w-full h-full min-h-[50px] flex items-center px-2">
                                                            <div className="relative w-full">
                                                                <input
                                                                    type="text" // Using text to allow placeholder in builder, but conceptually it's number
                                                                    value={cell}
                                                                    onChange={(e) => updateCell(row.id, colIndex, e.target.value)}
                                                                    className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-black/20 focus:border-black placeholder-gray-300 hover:border-gray-400 transition-colors"
                                                                    placeholder="Valeur num."
                                                                />
                                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                                                    <Hash className="w-3 h-3" />
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {(row.type === 'checkbox' || row.type === 'checkbox_multi' || row.type === 'checkbox_single') && (
                                                        <div className="w-full h-full min-h-[50px] flex items-center justify-center p-2">
                                                            <div className="flex flex-col items-center justify-center w-full h-full border border-dashed border-gray-200 rounded-md bg-gray-50/50">
                                                                {row.type === 'checkbox_single' ? (
                                                                    <div className="w-5 h-5 rounded-full border-2 border-gray-400 opacity-50 cursor-not-allowed"></div>
                                                                ) : (
                                                                    <div className="w-5 h-5 border-2 border-gray-500 rounded bg-white opacity-50 cursor-not-allowed"></div>
                                                                )}
                                                                <span className="text-[10px] text-gray-400 mt-1">
                                                                    {row.type === 'checkbox_single' ? 'Choix unique' : 'Choix multiple'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </td>
                                    ))}
                                    <td className="bg-gray-50/30"></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer Actions */}
                <div className="bg-gray-50 border-t border-gray-200 p-4">
                    <button
                        onClick={addRow}
                        className="flex items-center text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Ajouter un critère (ligne)
                    </button>
                </div>
            </div>

            {/* Synthesis Section Configuration */}
            <div className="border border-gray-200 rounded-lg p-6 bg-gray-50/50">
                <div className="flex items-start space-x-4">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                        <Settings2 className="w-5 h-5" />
                    </div>
                    <div className="flex-1 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-semibold text-gray-900">Champ de Synthèse</h3>
                                <p className="text-sm text-gray-500">Ajouter une zone de commentaire global ou de synthèse en bas du tableau.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={synthesisEnabled}
                                    onChange={(e) => setSynthesisEnabled(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>

                        {synthesisEnabled && (
                            <div className="space-y-3 pt-4 border-t border-gray-200/50">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Titre de la section</label>
                                    <input
                                        type="text"
                                        value={synthesisTitle}
                                        onChange={(e) => setSynthesisTitle(e.target.value)}
                                        className="w-full max-w-md rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                        placeholder="Synthèse, Observations générales..."
                                    />
                                </div>

                                {/* Preview of Synthesis Field */}
                                <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg border-dashed">
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Aperçu</p>
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-semibold text-gray-900">{synthesisTitle || "Sans titre"}</h4>
                                        <div className="w-full h-24 bg-gray-50 border border-gray-200 rounded-md"></div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Global Actions */}
            <div className="flex justify-end pt-4 border-t border-gray-100">
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center px-5 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-black transition-all shadow-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSaving ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Sauvegarde...
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4 mr-2" />
                            Sauvegarder la structure
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};
