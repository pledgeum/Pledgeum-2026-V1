'use client';

import { useState, useEffect } from 'react';
import { X, MessageSquare, Bug, Lightbulb, Send } from 'lucide-react';
import { useAdminStore, FeedbackType } from '@/store/admin';
import { useUserStore } from '@/store/user';
import { useAuth } from '@/context/AuthContext';

interface FeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
    // We can pass pre-filled data or fetch it from context
}

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
    const { user } = useAuth();
    const { role } = useUserStore();
    const { addFeedback } = useAdminStore();

    // Form State
    const [type, setType] = useState<FeedbackType>('IMPROVEMENT');
    const [message, setMessage] = useState('');
    const [schoolName, setSchoolName] = useState('');
    const [isSubmitted, setIsSubmitted] = useState(false);

    // Reset when opening
    useEffect(() => {
        if (isOpen) {
            setIsSubmitted(false);
            setMessage('');
            // Optional: try to auto-fill school name if we had it in user profile
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Basic validation
        if (!message.trim() || !schoolName.trim()) return;

        addFeedback({
            schoolName,
            userName: user?.email?.split('@')[0] || 'Utilisateur', // Simple fallback
            userEmail: user?.email || '',
            userRole: role,
            type,
            message
        });

        setIsSubmitted(true);
        setTimeout(() => {
            onClose();
        }, 2000);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
                {!isSubmitted ? (
                    <>
                        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex justify-between items-center text-white">
                            <h3 className="font-bold flex items-center">
                                <MessageSquare className="w-5 h-5 mr-2" />
                                Votre avis nous intéresse
                            </h3>
                            <button onClick={onClose} className="text-blue-100 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <p className="text-sm text-gray-600 mb-4">
                                En tant qu'établissement partenaire, vos retours sont essentiels pour améliorer notre plateforme.
                            </p>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Type de retour</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setType('IMPROVEMENT')}
                                        className={`flex items-center justify-center px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${type === 'IMPROVEMENT' ? 'bg-blue-50 border-blue-500 text-blue-700 ring-1 ring-blue-500' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                                    >
                                        <Lightbulb className="w-4 h-4 mr-2" />
                                        Suggestion
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setType('BUG')}
                                        className={`flex items-center justify-center px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${type === 'BUG' ? 'bg-red-50 border-red-500 text-red-700 ring-1 ring-red-500' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                                    >
                                        <Bug className="w-4 h-4 mr-2" />
                                        Problème
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Nom de votre établissement</label>
                                <input
                                    type="text"
                                    value={schoolName}
                                    onChange={(e) => setSchoolName(e.target.value)}
                                    placeholder="Ex: Lycée Jean Jaurès, Paris"
                                    className="w-full text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Votre message</label>
                                <textarea
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    rows={5}
                                    placeholder={type === 'IMPROVEMENT' ? "Il serait utile d'avoir..." : "J'ai rencontré une erreur lorsque..."}
                                    className="w-full text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg flex items-center justify-center transition-colors shadow-sm"
                            >
                                <Send className="w-4 h-4 mr-2" />
                                Envoyer le retour
                            </button>
                        </form>
                    </>
                ) : (
                    <div className="p-8 text-center bg-green-50">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                            <Send className="w-8 h-8 text-green-600" />
                        </div>
                        <h3 className="text-xl font-bold text-green-800 mb-2">Merci !</h3>
                        <p className="text-green-700 mb-6">Votre retour a bien été transmis aux administrateurs.</p>
                        <button onClick={onClose} className="text-sm font-medium text-green-800 hover:text-green-900 underline">
                            Fermer
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
