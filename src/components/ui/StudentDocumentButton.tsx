
import { useState, useEffect } from 'react';
import { FileText, Download, Loader2 } from 'lucide-react';
import { useDocumentStore } from '@/store/documents';

export function StudentDocumentButton({ classId }: { classId?: string }) {
    const { documents, fetchDocuments } = useDocumentStore();
    const [isOpen, setIsOpen] = useState(false);

    // Fetch on mount if class ID exists (or when opening to save reads?)
    // Let's fetch on mount of this button to have count? Or just create a lightweight checker.
    // Given the store structure, calling fetchDocuments wipes previous state unless managed carefully.
    // The store replaces `documents`. If we have multiple cards from different classes (unlikely for student), this might flicker.
    // But a student is in ONE class usually. So fetching once in parent would be better.
    // However, keeping it simple: Fetch when user clicks to view?

    const handleOpen = () => {
        if (!classId) return;
        fetchDocuments(classId);
        setIsOpen(true);
    };

    if (!classId) return null;

    return (
        <div className="relative">
            <button
                onClick={handleOpen}
                className="flex items-center px-3 py-2 border border-indigo-200 shadow-sm text-sm font-medium rounded-md text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
            >
                <FileText className="w-4 h-4 mr-2" />
                Documents Complémentaires
            </button>

            {isOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-96 max-w-[90vw] bg-white rounded-lg shadow-xl border border-gray-200 z-50 p-2">
                    <div className="flex justify-between items-center bg-gray-50 p-2 rounded mb-2">
                        <span className="text-xs font-bold text-gray-700">Documents de la classe</span>
                        <button onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} className="text-gray-400 hover:text-gray-600">×</button>
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-1">
                        {documents.length === 0 ? (
                            <p className="text-xs text-center text-gray-400 py-2">Aucun document.</p>
                        ) : (
                            documents.map(doc => (
                                <a
                                    key={doc.id}
                                    href={doc.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block p-2 hover:bg-indigo-50 rounded flex items-center justify-between group"
                                >
                                    <div className="flex items-center overflow-hidden mr-2">
                                        <FileText className="w-3 h-3 text-indigo-400 mr-2 shrink-0" />
                                        <span className="text-xs text-gray-700 break-words" title={doc.name}>{doc.name}</span>
                                    </div>
                                    <Download className="w-3 h-3 text-gray-400 group-hover:text-indigo-600 shrink-0" />
                                </a>
                            ))
                        )}
                    </div>
                </div>
            )}
            {/* Backdrop to close */}
            {isOpen && <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>}
        </div>
    );
}
