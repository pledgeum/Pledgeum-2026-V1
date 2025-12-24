import React, { useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface DeleteAccountModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDelete: () => Promise<void>;
}

export function DeleteAccountModal({ isOpen, onClose, onDelete }: DeleteAccountModalProps) {
    const [step, setStep] = useState<1 | 2>(1);
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleNext = () => setStep(2);

    const handleConfirm = async () => {
        setLoading(true);
        await onDelete();
        setLoading(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border-2 border-red-100">
                {/* Header */}
                <div className="bg-red-50 p-4 border-b border-red-100 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-red-700 flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        {step === 1 ? 'Suppression de compte' : 'Confirmation Finale'}
                    </h3>
                    <button onClick={onClose} className="text-red-400 hover:text-red-700 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    {step === 1 ? (
                        <div className="space-y-4">
                            <p className="font-semibold text-gray-900">
                                ATTENTION : Vous êtes sur le point de supprimer définitivement votre compte.
                            </p>
                            <p className="text-gray-600 text-sm">
                                Cette action entraînera l'anonymisation immédiate de toutes vos données personnelles (Nom, Prénom, Email, etc.).
                            </p>
                            <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 text-sm text-yellow-800 flex gap-2">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <p>Cette action est irréversible.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 text-center">
                            <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-2">
                                <Trash2 className="w-6 h-6 text-red-600" />
                            </div>
                            <h4 className="text-xl font-bold text-gray-900">Êtes-vous vraiment sûr ?</h4>

                            <p className="text-gray-600">
                                En cliquant sur confirmer, votre compte sera immédiatement supprimé et vos accès révoqués.
                            </p>

                            <p className="text-sm font-bold text-red-600 bg-red-50 p-3 rounded border border-red-200">
                                <span className="underline decoration-2 decoration-red-600 underline-offset-2">
                                    Aucune donnée ne pourra être récupérée.
                                </span>
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 border-t flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        Annuler
                    </button>

                    {step === 1 ? (
                        <button
                            onClick={handleNext}
                            className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors shadow-sm"
                        >
                            Continuer
                        </button>
                    ) : (
                        <button
                            onClick={handleConfirm}
                            disabled={loading}
                            className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 hover:scale-105 transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            TOUT SUPPRIMER
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// Import Loader2 for the button icon (forgot to import above)
import { Loader2 } from 'lucide-react';
