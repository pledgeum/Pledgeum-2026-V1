import React, { useState } from 'react';
import { X, Phone, Mail, Building, User, MapPin, ExternalLink, Contact, Briefcase, Smartphone } from 'lucide-react';
import { Convention } from '@/store/convention';

interface ContactCompanyModalProps {
    isOpen: boolean;
    onClose: () => void;
    conventions: Convention[];
}

export function ContactCompanyModal({ isOpen, onClose, conventions }: ContactCompanyModalProps) {
    const [selectedConvId, setSelectedConvId] = useState<string | null>(
        conventions.length === 1 ? conventions[0].id : null
    );

    if (!isOpen) return null;

    const targetConvention = conventions.find(c => c.id === selectedConvId);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b bg-gray-50/50">
                    <div className="flex items-center gap-3">
                        <div className="bg-emerald-100 p-2 rounded-lg">
                            <Building className="w-6 h-6 text-emerald-600" />
                        </div>
                        <h3 className="font-bold text-xl text-gray-900 leading-tight">
                            Contacter une entreprise
                        </h3>

                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                    >
                        <X className="w-6 h-6 text-gray-400" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6">
                    {/* Student Selection (if multiple) */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            Concernant quel élève ?
                        </label>
                        <select
                            value={selectedConvId || ''}
                            onChange={(e) => setSelectedConvId(e.target.value)}
                            className="w-full rounded-xl border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 border p-3 bg-white text-gray-900 font-medium"
                        >
                            <option value="">-- Sélectionner un élève --</option>
                            {conventions.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.eleve_nom} {c.eleve_prenom} ({c.eleve_classe})
                                </option>
                            ))}
                        </select>
                    </div>

                    {targetConvention ? (
                        <div className="space-y-6 animate-in slide-in-from-top-4 duration-300">
                            {/* Tutor Card */}
                            <div className="bg-emerald-50/50 rounded-2xl p-5 border border-emerald-100">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="bg-white p-2 rounded-full shadow-sm">
                                        <User className="w-5 h-5 text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-emerald-900">
                                            {targetConvention.tuteur_prenom} {targetConvention.tuteur_nom}
                                        </p>
                                        <p className="text-xs text-emerald-600 font-medium">{targetConvention.tuteur_fonction || 'Tuteur de stage'}</p>
                                    </div>
                                </div>
                                
                                <div className="space-y-3">
                                    <a 
                                        href={`mailto:${targetConvention.tuteur_email}`}
                                        className="flex items-center gap-3 p-3 bg-white hover:bg-emerald-50 rounded-xl border border-emerald-100 transition-colors group"
                                    >
                                        <Mail className="w-5 h-5 text-emerald-500 group-hover:scale-110 transition-transform" />
                                        <span className="text-sm font-medium text-gray-700 truncate">{targetConvention.tuteur_email}</span>
                                        <ExternalLink className="w-3 h-3 text-gray-400 ml-auto" />
                                    </a>
                                    {targetConvention.tuteur_telephone && (
                                        <a 
                                            href={`tel:${targetConvention.tuteur_telephone}`}
                                            className="flex items-center gap-3 p-3 bg-white hover:bg-emerald-50 rounded-xl border border-emerald-100 transition-colors group"
                                        >
                                            <Smartphone className="w-5 h-5 text-emerald-500 group-hover:scale-110 transition-transform" />
                                            <div className="flex flex-col">
                                                <span className="text-xs text-gray-400 font-medium leading-none mb-1">Portable / Personnel</span>
                                                <span className="text-sm font-bold text-gray-700">{targetConvention.tuteur_telephone}</span>
                                            </div>
                                            <ExternalLink className="w-3 h-3 text-gray-400 ml-auto" />
                                        </a>
                                    )}
                                    {targetConvention.tuteur_tel && targetConvention.tuteur_tel !== targetConvention.tuteur_telephone && (
                                        <a 
                                            href={`tel:${targetConvention.tuteur_tel}`}
                                            className="flex items-center gap-3 p-3 bg-white hover:bg-emerald-50 rounded-xl border border-emerald-100 transition-colors group"
                                        >
                                            <Phone className="w-5 h-5 text-emerald-500 group-hover:scale-110 transition-transform" />
                                            <span className="text-sm font-medium text-gray-700">{targetConvention.tuteur_tel}</span>
                                            <ExternalLink className="w-3 h-3 text-gray-400 ml-auto" />
                                        </a>
                                    )}
                                </div>
                            </div>

                            {/* Company Card */}
                            <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="bg-white p-2 rounded-full shadow-sm">
                                        <Briefcase className="w-5 h-5 text-gray-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-900">{targetConvention.ent_nom}</p>
                                        <p className="text-xs text-gray-500 font-medium">Siège social / Administratif</p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-gray-100">
                                        <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-medium text-gray-700">{targetConvention.ent_adresse}</p>
                                            <p className="text-sm font-medium text-gray-700">{targetConvention.ent_code_postal} {targetConvention.ent_ville}</p>
                                        </div>
                                    </div>
                                    <a 
                                        href={`mailto:${targetConvention.ent_rep_email}`}
                                        className="flex items-center gap-3 p-3 bg-white hover:bg-emerald-50 rounded-xl border border-gray-100 transition-colors group"
                                    >
                                        <Mail className="w-5 h-5 text-emerald-500 group-hover:scale-110 transition-transform" />
                                        <div className="flex flex-col">
                                            <span className="text-xs text-gray-400 font-medium leading-none mb-1">Contact Administratif (Signataire)</span>
                                            <span className="text-sm font-bold text-gray-700 truncate">{targetConvention.ent_rep_nom || targetConvention.ent_rep_email}</span>
                                            {targetConvention.ent_rep_fonction && (
                                                <span className="text-xs text-gray-500 mt-0.5">{targetConvention.ent_rep_fonction}</span>
                                            )}
                                        </div>
                                        <ExternalLink className="w-3 h-3 text-gray-400 ml-auto" />
                                    </a>

                                    {targetConvention.signataire_telephone && (
                                        <a 
                                            href={`tel:${targetConvention.signataire_telephone}`}
                                            className="flex items-center gap-3 p-3 bg-white hover:bg-emerald-50 rounded-xl border border-gray-100 transition-colors group"
                                        >
                                            <Smartphone className="w-5 h-5 text-emerald-500 group-hover:scale-110 transition-transform" />
                                            <div className="flex flex-col">
                                                <span className="text-xs text-gray-400 font-medium leading-none mb-1">Portable / Personnel (Signataire)</span>
                                                <span className="text-sm font-bold text-gray-700">{targetConvention.signataire_telephone}</span>
                                            </div>
                                            <ExternalLink className="w-3 h-3 text-gray-400 ml-auto" />
                                        </a>
                                    )}
                                </div>
                            </div>

                            {/* Stage Location Card (if different) */}
                            {targetConvention.stage_adresse_differente && targetConvention.stage_lieu && (
                                <div className="bg-blue-50/50 rounded-2xl p-5 border border-blue-100 border-dashed">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="bg-white p-2 rounded-full shadow-sm">
                                            <MapPin className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <p className="text-sm font-bold text-blue-900">Lieu effectif du stage</p>
                                    </div>
                                    <div className="p-3 bg-white rounded-xl border border-blue-100">
                                        <p className="text-sm font-medium text-gray-700 whitespace-pre-line">
                                            {targetConvention.stage_lieu}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        selectedConvId && (
                            <p className="text-center text-gray-500 py-8">Aucune coordonnée trouvée pour cet élève.</p>
                        )
                    )}
                </div>

                <div className="p-6 border-t bg-gray-50/50 flex justify-end">
                    <button 
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors shadow-lg shadow-gray-900/10 active:scale-95 transition-all"
                    >
                        Fermer
                    </button>
                </div>
            </div>
        </div>
    );
}
