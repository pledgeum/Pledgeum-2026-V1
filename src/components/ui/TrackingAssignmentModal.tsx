import React, { useState } from 'react';
import { useConventionStore } from '@/store/convention';
import { toast } from 'sonner';

interface TrackingAssignmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    conventionId: string | null;
}

export default function TrackingAssignmentModal({ isOpen, onClose, conventionId }: TrackingAssignmentModalProps) {
    const [email, setEmail] = useState('');
    const { assignTrackingTeacher } = useConventionStore();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!conventionId || !email) return;

        try {
            await assignTrackingTeacher(conventionId, email);
            toast.success("Enseignant de suivi assigné avec succès");
            onClose();
            setEmail('');
        } catch (error) {
            console.error(error);
            toast.error("Erreur lors de l'assignation");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-gray-900">Assigner un enseignant de suivi</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Cet enseignant aura accès à la convention en lecture seule.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label htmlFor="tracking-email" className="block text-sm font-medium text-gray-700 mb-1">
                            Email de l'enseignant
                        </label>
                        <input
                            type="email"
                            id="tracking-email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="enseignant@ecole.fr"
                            required
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                            Assigner
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
