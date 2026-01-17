import React, { useState, useEffect } from 'react';
import { X, Check, User, Mail, MapPin, Phone } from 'lucide-react';
import { Convention } from '@/store/convention';
import { useUserStore } from '@/store/user';
import { auth } from '@/lib/firebase';

interface ParentValidationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onValidated: () => void;
    convention: Convention;
}

export function ParentValidationModal({ isOpen, onClose, onValidated, convention }: ParentValidationModalProps) {
    const { name, email, profileData, updateProfileData } = useUserStore();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        rep_legal_nom: '',
        rep_legal_email: '',
        rep_legal_tel: '',
        rep_legal_adresse: ''
    });

    useEffect(() => {
        if (isOpen) {
            let addrStr = '';
            const addr = profileData?.address;
            if (typeof addr === 'string') {
                addrStr = addr;
            } else if (addr && typeof addr === 'object') {
                const zip = (addr as any).zipCode || (addr as any).postalCode || '';
                addrStr = `${addr.street || ''}, ${zip} ${addr.city || ''}`.trim();
            }

            setFormData({
                rep_legal_nom: name || convention.rep_legal_nom || '',
                rep_legal_email: email || convention.rep_legal_email || '',
                rep_legal_tel: profileData?.phone || convention.rep_legal_tel || '',
                rep_legal_adresse: addrStr || convention.rep_legal_adresse || ''
            });
        }
    }, [isOpen, convention, name, email, profileData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Update User Profile instead of Convention
            if (auth.currentUser) {
                await updateProfileData(auth.currentUser.uid, {
                    phone: formData.rep_legal_tel,
                    // address: formData.rep_legal_adresse, // Cannot update structured address from string
                    name: formData.rep_legal_nom,
                    email: formData.rep_legal_email
                });
            }
            // Proceed to signature (updates status only)
            onValidated();
        } catch (error) {
            console.error("Failed to update parent profile:", error);
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
                        <h3 className="text-lg font-bold text-blue-900">Vérification de vos coordonnées</h3>
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
                            value={formData.rep_legal_nom}
                            onChange={e => setFormData({ ...formData, rep_legal_nom: e.target.value })}
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
                            value={formData.rep_legal_email}
                            onChange={e => setFormData({ ...formData, rep_legal_email: e.target.value })}
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
                            value={formData.rep_legal_tel}
                            onChange={e => setFormData({ ...formData, rep_legal_tel: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                            <MapPin className="w-4 h-4" /> Adresse
                        </label>
                        <textarea
                            required
                            rows={2}
                            value={formData.rep_legal_adresse}
                            onChange={e => setFormData({ ...formData, rep_legal_adresse: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
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
