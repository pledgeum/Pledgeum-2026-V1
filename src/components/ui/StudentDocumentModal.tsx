'use client';

import { useEffect } from 'react';
import { FileText, Download, Loader2 } from 'lucide-react';
import { useDocumentStore } from '@/store/documents';

interface StudentDocumentModalProps {
    classId: string | null;
    onClose: () => void;
}

export function StudentDocumentModal({ classId, onClose }: StudentDocumentModalProps) {
    const { documents, fetchDocuments, loading } = useDocumentStore();

    useEffect(() => {
        if (classId) {
            fetchDocuments(classId);
        }
    }, [classId, fetchDocuments]);

    if (!classId) return null;

    return (
        <div className="fixed inset-0 z-[100] overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                {/* Backdrop */}
                <div
                    className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
                    aria-hidden="true"
                    onClick={onClose}
                ></div>

                {/* Centering Trick */}
                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                {/* Modal Panel */}
                <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full sm:p-6">

                    <div className="sm:flex sm:items-start mb-4">
                        <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100 sm:mx-0 sm:h-10 sm:w-10">
                            <FileText className="h-6 w-6 text-indigo-600" />
                        </div>
                        <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
                            <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                                Documents de la Classe
                            </h3>
                            <div className="mt-2">
                                <p className="text-sm text-gray-500">
                                    Téléchargez les documents mis à disposition par votre équipe pédagogique.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
                        >
                            <span className="sr-only">Fermer</span>
                            <span className="text-2xl font-light">&times;</span>
                        </button>
                    </div>

                    <div className="mt-4 border-t border-gray-100 pt-4">
                        {loading ? (
                            <div className="flex justify-center py-4">
                                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                            </div>
                        ) : documents.length === 0 ? (
                            <p className="text-sm text-gray-500 italic text-center py-4">Aucun document disponible pour le moment.</p>
                        ) : (
                            <ul className="divide-y divide-gray-100">
                                {documents.map(doc => {
                                    if (!doc.url) console.warn("Document missing URL:", doc);
                                    return (
                                        <li key={doc.id} className="py-3 flex items-center justify-between group hover:bg-gray-50 -mx-2 px-2 rounded-md transition-colors">
                                            <div className="flex items-center overflow-hidden mr-3">
                                                <div className="bg-indigo-50 p-2 rounded-lg mr-3">
                                                    <FileText className="w-4 h-4 text-indigo-600" />
                                                </div>
                                                <div className="truncate">
                                                    <p className="text-sm font-medium text-gray-900 truncate" title={doc.name}>
                                                        {doc.name}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        Ajouté le {new Date(doc.createdAt).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                            {doc.url ? (
                                                <a
                                                    href={doc.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-full text-indigo-700 bg-indigo-100 hover:bg-indigo-200 transition-colors cursor-pointer"
                                                    onClick={(e) => {
                                                        console.log("Downloading document:", doc.name, doc.url);
                                                        // Optional: prevent default if you want to handle download manually, but _blank is usually best for PDF
                                                    }}
                                                >
                                                    <Download className="w-3 h-3 mr-1" />
                                                    Télécharger
                                                </a>
                                            ) : (
                                                <span className="text-xs text-gray-400 italic">Indisponible</span>
                                            )}
                                        </li>
                                    )
                                })}
                            </ul>
                        )}
                    </div>

                    <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                        <button
                            type="button"
                            className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                            onClick={onClose}
                        >
                            Fermer
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
