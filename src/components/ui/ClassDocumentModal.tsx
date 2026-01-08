'use client';

import { useState, useEffect } from 'react';
import { X, Upload, Trash2, FileText, Download, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useSchoolStore } from '@/store/school';
import { useDocumentStore, ClassDocument } from '@/store/documents';
import { useAuth } from '@/context/AuthContext';
import { useUserStore } from '@/store/user';
import { uploadClassDocument } from '@/app/actions/documents';

interface ClassDocumentModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ClassDocumentModal({ isOpen, onClose }: ClassDocumentModalProps) {
    const { classes } = useSchoolStore();
    const { documents, fetchDocuments, fetchUserDocuments, uploadDocument, assignDocumentToClasses, deleteDocument, loading, error } = useDocumentStore();
    const { user } = useAuth();
    const { role } = useUserStore();

    const [activeTab, setActiveTab] = useState<'upload' | 'library'>('upload');
    const [editingDocId, setEditingDocId] = useState<string | null>(null);

    const [file, setFile] = useState<File | null>(null);
    const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (activeTab === 'library' && user) {
                fetchUserDocuments(user.uid);
            } else {
                fetchDocuments();
            }
        }
    }, [isOpen, activeTab, fetchDocuments, fetchUserDocuments, user]);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selected = e.target.files[0];
            if (selected.type !== 'application/pdf') {
                alert("Seuls les fichiers PDF sont acceptés.");
                return;
            }
            setFile(selected);
        }
    };

    const toggleClass = (id: string, currentSelection: string[], setSelection: (s: string[]) => void) => {
        setSelection(
            currentSelection.includes(id) ? currentSelection.filter(c => c !== id) : [...currentSelection, id]
        );
    };

    const handleUpload = async () => {
        if (!file || selectedClassIds.length === 0 || !user) return;

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('classIds', JSON.stringify(selectedClassIds));
            formData.append('uploadedBy', user.uid);
            formData.append('type', 'OTHER');

            const result = await uploadClassDocument(formData);

            if (result.success) {
                setFile(null);
                setSelectedClassIds([]);
                alert("Document ajouté avec succès !");
                fetchDocuments(); // Refresh list associated effectively
            } else {
                alert("Erreur lors de l'upload : " + result.error);
            }
        } catch (err) {
            console.error(err);
            alert("Erreur inattendue lors de l'upload.");
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (doc: ClassDocument) => {
        if (!confirm("Êtes-vous sûr de vouloir supprimer ce document ?")) return;
        await deleteDocument(doc.id, doc.url);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-gray-500/75 transition-opacity"
                aria-hidden="true"
                onClick={onClose}
            />

            {/* Modal Panel */}
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col z-10">

                {/* Header */}
                <div className="flex items-start justify-between p-6 border-b border-gray-200">
                    <div className="flex items-center">
                        <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 sm:h-10 sm:w-10">
                            <FileText className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="ml-4">
                            <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                                Gestion des Documents de Classe
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">
                                Ajoutez des recommandations, cours ou évaluations pour vos classes.
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none">
                        <span className="sr-only">Fermer</span>
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* TABS */}
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex px-6 space-x-8" aria-label="Tabs">
                        <button
                            onClick={() => setActiveTab('upload')}
                            className={`${activeTab === 'upload'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
                        >
                            <Upload className="w-4 h-4 mr-2" />
                            Nouveau Document
                        </button>
                        <button
                            onClick={() => setActiveTab('library')}
                            className={`${activeTab === 'library'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
                        >
                            <FileText className="w-4 h-4 mr-2" />
                            Ma Bibliothèque / Réutiliser
                        </button>
                    </nav>
                </div>

                {/* Content - Scrollable */}
                <div className="p-6 overflow-y-auto flex-1">
                    {activeTab === 'upload' ? (
                        <>
                            {/* Upload Section */}
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
                                <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center">
                                    <Upload className="w-4 h-4 mr-2" />
                                    Mettre en ligne un nouveau document
                                </h4>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Fichier (PDF uniquement)</label>
                                        <input
                                            type="file"
                                            accept="application/pdf"
                                            onChange={handleFileChange}
                                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Attribuer aux classes :</label>
                                        <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border p-2 rounded bg-white">
                                            {(classes || []).map(cls => (
                                                <label key={cls.id} className="flex items-center space-x-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedClassIds.includes(cls.id)}
                                                        onChange={() => toggleClass(cls.id, selectedClassIds, setSelectedClassIds)}
                                                        className="rounded text-blue-600 focus:ring-blue-500"
                                                    />
                                                    <span className="truncate">{cls.name}</span>
                                                </label>
                                            ))}
                                            {(!classes || classes.length === 0) && (
                                                <p className="text-xs text-gray-500 italic col-span-2">Aucune classe disponible.</p>
                                            )}
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleUpload}
                                        disabled={!file || selectedClassIds.length === 0 || uploading}
                                        className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
                                    ${(!file || selectedClassIds.length === 0 || uploading) ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                                    >
                                        {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Mettre en ligne et attribuer'}
                                    </button>
                                </div>
                            </div>

                            {/* List Section */}
                            <div>
                                <h4 className="text-sm font-bold text-gray-900 mb-3">Documents actifs (Tous)</h4>
                                {/* Existing List Logic... */}
                                {loading && !uploading ? (
                                    <div className="text-center py-4"><Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500" /></div>
                                ) : error ? (
                                    <div className="text-red-500 text-sm">{error}</div>
                                ) : (documents.length === 0) ? (
                                    <p className="text-sm text-gray-500 italic text-center py-4">Aucun document.</p>
                                ) : (
                                    <ul className="divide-y divide-gray-200 border rounded-md">
                                        {documents.map(doc => (
                                            <li key={doc.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                                                <div className="flex items-center overflow-hidden">
                                                    <FileText className="h-5 w-5 text-gray-400 mr-3 flex-shrink-0" />
                                                    <div className="truncate">
                                                        <p className="text-sm font-medium text-gray-900 truncate" title={doc.name}>{doc.name}</p>
                                                        <p className="text-xs text-gray-500 truncate">
                                                            Pour : {(classes || []).filter(c => doc.classIds && doc.classIds.includes(c.id)).map(c => c.name).join(', ') || 'Classes inconnues'}
                                                            {/* • {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : 'Date inconnue'} */}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center ml-4 space-x-2">
                                                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="p-1 text-gray-400 hover:text-blue-600" title="Télécharger">
                                                        <Download className="w-4 h-4" />
                                                    </a>
                                                    <button onClick={() => handleDelete(doc)} className="p-1 text-gray-400 hover:text-red-600" title="Supprimer">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </>
                    ) : (
                        // LIBRARY TAB
                        <div className="space-y-4">
                            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded text-sm mb-4">
                                <p>Retrouvez ici tous les documents que vous avez mis en ligne. Vous pouvez modifier les classes auxquelles ils sont attribués.</p>
                            </div>

                            {loading ? (
                                <div className="text-center py-10"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" /></div>
                            ) : documents.length === 0 ? (
                                <div className="text-center py-10 text-gray-500 italic">Vous n'avez mis en ligne aucun document.</div>
                            ) : (
                                <div className="grid grid-cols-1 gap-4">
                                    {documents.map(doc => (
                                        <div key={doc.id} className={`border rounded-lg p-4 transition-colors ${editingDocId === doc.id ? 'border-blue-500 bg-blue-50/10 ring-1 ring-blue-500' : 'border-gray-200 hover:border-blue-300'}`}>
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center">
                                                    <div className="bg-gray-100 p-2 rounded mr-3">
                                                        <FileText className="w-5 h-5 text-gray-600" />
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-gray-900 text-sm">{doc.name}</p>
                                                        <p className="text-xs text-gray-500">Ajouté le {new Date(doc.createdAt).toLocaleDateString()}</p>
                                                    </div>
                                                </div>

                                                <div className="flex space-x-2">
                                                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600 p-1">
                                                        <Download className="w-4 h-4" />
                                                    </a>
                                                    <button onClick={() => handleDelete(doc)} className="text-gray-400 hover:text-red-500 p-1" title="Supprimer ce document">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="mt-3">
                                                <div className="flex justify-between items-center mb-1">
                                                    <label className="text-xs font-bold text-gray-700 uppercase">Attribué aux classes :</label>
                                                    {editingDocId !== doc.id && (
                                                        <button
                                                            onClick={() => setEditingDocId(doc.id)}
                                                            className="text-xs text-blue-600 hover:underline font-medium"
                                                        >
                                                            Modifier les classes
                                                        </button>
                                                    )}
                                                </div>

                                                {editingDocId === doc.id ? (
                                                    <div className="mt-2 bg-white border border-gray-300 rounded p-3">
                                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3 max-h-40 overflow-y-auto">
                                                            {(classes || []).map(cls => (
                                                                <label key={cls.id} className="flex items-center space-x-2 text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={(doc.classIds || []).includes(cls.id)}
                                                                        onChange={async () => {
                                                                            const current = doc.classIds || [];
                                                                            const newIds = current.includes(cls.id)
                                                                                ? current.filter(id => id !== cls.id)
                                                                                : [...current, cls.id];

                                                                            // Optimistic UI update could be complex with store, so let's call store directly
                                                                            assignDocumentToClasses(doc.id, newIds);
                                                                        }}
                                                                        className="rounded text-blue-600 focus:ring-blue-500 h-3 w-3"
                                                                    />
                                                                    <span className="truncate">{cls.name}</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                        <div className="flex justify-end">
                                                            <button
                                                                onClick={() => setEditingDocId(null)}
                                                                className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                                                            >
                                                                Terminer
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {(doc.classIds && doc.classIds.length > 0) ? doc.classIds.map(cid => {
                                                            const cName = classes.find(c => c.id === cid)?.name || 'Inconnue';
                                                            return (
                                                                <span key={cid} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                                                    {cName}
                                                                </span>
                                                            );
                                                        }) : (
                                                            <span className="text-xs text-orange-500 italic">Non attribué</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-6 py-4 flex flex-row-reverse rounded-b-lg border-t border-gray-200">
                    <button
                        type="button"
                        className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                        onClick={onClose}
                    >
                        Fermer
                    </button>
                </div>
            </div>
        </div >
    );
}
