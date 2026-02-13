import React, { useState, useEffect } from 'react';
import { X, Check, User, Mail, Phone, Briefcase } from 'lucide-react';
import { Convention } from '@/store/convention';
import { useUserStore } from '@/store/user';

interface SchoolHeadValidationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onValidated: () => void;
    convention: Convention;
}

export function SchoolHeadValidationModal({ isOpen, onClose, onValidated, convention }: SchoolHeadValidationModalProps) {
    const { name, email, profileData, updateProfileData } = useUserStore();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        ecole_chef_nom: '',
        ecole_chef_email: '',
        ecole_chef_tel: '',
        ecole_chef_fonction: '' // Function is less critical for head, but good to have
    });

    useEffect(() => {
        if (isOpen) {
            setFormData({
                ecole_chef_nom: name || convention.ecole_chef_nom || '',
                ecole_chef_email: email || convention.ecole_chef_email || '',
                ecole_chef_tel: profileData?.phone || convention.ecole_tel || '', // Fallback to school phone if individual phone missing
                ecole_chef_fonction: 'Chef d\'établissement' // Default
            });
        }
    }, [isOpen, convention, name, email, profileData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const userId = useUserStore.getState().id;
            if (userId) {
                await updateProfileData(userId, {
                    phone: formData.ecole_chef_tel,
                    name: formData.ecole_chef_nom,
                    email: formData.ecole_chef_email,
                });
            }
            onValidated();
        } catch (error) {
            console.error("Failed to update school head profile:", error);
            alert("Une erreur est survenue lors de la mise à jour du profil.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
                <div className="px-6 py-4 bg-purple-50 border-b border-purple-100 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold text-purple-900">Validation Chef d'Établissement</h3>
                        <p className="text-xs text-purple-700">Veuillez valider vos informations avant de signer.</p>
                    </div>
                    <button onClick={onClose} className="text-purple-400 hover:text-purple-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                            <User className="w-4 h-4" /> Nom et Prénom
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.ecole_chef_nom}
                            onChange={e => setFormData({ ...formData, ecole_chef_nom: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                            <Mail className="w-4 h-4" /> Email
                        </label>
                        <input
                            type="email"
                            required
                            value={formData.ecole_chef_email}
                            onChange={e => setFormData({ ...formData, ecole_chef_email: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                            <Phone className="w-4 h-4" /> Téléphone
                        </label>
                        <input
                            type="tel"
                            required
                            value={formData.ecole_chef_tel}
                            onChange={e => setFormData({ ...formData, ecole_chef_tel: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        />
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                        >
                            {loading ? 'Validation...' : (
                                <>
                                    <Check className="w-4 h-4" />
                                    Valider et Signer
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
