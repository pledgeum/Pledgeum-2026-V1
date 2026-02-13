import React, { useState, useEffect } from 'react';
import { X, Check, User, Mail, Phone, Briefcase } from 'lucide-react';
import { Convention } from '@/store/convention';
import { useUserStore } from '@/store/user';

interface CompanyValidationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onValidated: () => void;
    convention: Convention;
}

export function CompanyValidationModal({ isOpen, onClose, onValidated, convention }: CompanyValidationModalProps) {
    const { name, email, profileData, updateProfileData } = useUserStore();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        ent_rep_nom: '',
        ent_rep_email: '',
        ent_rep_tel: '', // This might not be standard in convention, but let's see
        ent_rep_fonction: ''
    });

    useEffect(() => {
        if (isOpen) {
            setFormData({
                ent_rep_nom: name || convention.ent_rep_nom || '',
                ent_rep_email: email || convention.ent_rep_email || '',
                ent_rep_tel: profileData?.phone || '', // Company rep phone often not distinct from company phone in flat schema
                ent_rep_fonction: convention.ent_rep_fonction || ''
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
                    phone: formData.ent_rep_tel,
                    name: formData.ent_rep_nom,
                    email: formData.ent_rep_email,
                });
            }
            onValidated();
        } catch (error) {
            console.error("Failed to update company rep profile:", error);
            alert("Une erreur est survenue lors de la mise à jour du profil.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
                <div className="px-6 py-4 bg-blue-50 border-b border-blue-100 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold text-blue-900">Vérification de vos coordonnées (Entreprise)</h3>
                        <p className="text-xs text-blue-700">Veuillez valider vos informations avant de signer.</p>
                    </div>
                    <button onClick={onClose} className="text-blue-400 hover:text-blue-600">
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
                            value={formData.ent_rep_nom}
                            onChange={e => setFormData({ ...formData, ent_rep_nom: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                            <Mail className="w-4 h-4" /> Email
                        </label>
                        <input
                            type="email"
                            required
                            value={formData.ent_rep_email}
                            onChange={e => setFormData({ ...formData, ent_rep_email: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                            <Phone className="w-4 h-4" /> Téléphone
                        </label>
                        <input
                            type="tel"
                            required
                            value={formData.ent_rep_tel}
                            onChange={e => setFormData({ ...formData, ent_rep_tel: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                            <Briefcase className="w-4 h-4" /> Fonction / Poste
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.ent_rep_fonction}
                            onChange={e => setFormData({ ...formData, ent_rep_fonction: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
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
