import { useState, useEffect } from 'react';
import { X, AlertTriangle, Save, Loader2 } from 'lucide-react';

interface EmailCorrectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentEmail: string;
    roleName: string;
    onSave: (newEmail: string) => Promise<void>;
}

export function EmailCorrectionModal({ isOpen, onClose, currentEmail, roleName, onSave }: EmailCorrectionModalProps) {
    const [email, setEmail] = useState(currentEmail);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setEmail(currentEmail);
        }
    }, [currentEmail, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!email || !email.includes('@')) {
            setError('Veuillez entrer une adresse email valide.');
            return;
        }

        try {
            setIsLoading(true);
            await onSave(email);
            onClose();
        } catch (err) {
            console.error(err);
            setError("Erreur lors de la mise à jour de l'email.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold text-red-700 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5" />
                            Email Invalide
                        </h3>
                    </div>
                    <button onClick={onClose} className="text-red-400 hover:text-red-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                        L'email actuel pour <strong>{roleName}</strong> semble être invalide ou l'envoi a échoué. Veuillez le corriger pour permettre la signature.
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">Nouvelle adresse email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="exemple@email.com"
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all ${error ? 'border-red-500 ring-red-200' : 'border-gray-300'}`}
                        />
                        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
                    </div>

                    {/* Footer - simplified inside form */}
                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isLoading}
                            className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || email === currentEmail}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold rounded-lg shadow hover:bg-blue-700 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Enregistrement...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Corriger l'email
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
