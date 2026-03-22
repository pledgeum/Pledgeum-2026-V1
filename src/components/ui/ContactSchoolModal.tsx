import React, { useState } from 'react';
import { X, Phone, Mail, School, User, BookOpen, ExternalLink, ShieldCheck } from 'lucide-react';
import { Convention } from '@/store/convention';

interface ContactSchoolModalProps {
    isOpen: boolean;
    onClose: () => void;
    conventions: Convention[];
}

export function ContactSchoolModal({ isOpen, onClose, conventions }: ContactSchoolModalProps) {
    const [selectedConvId, setSelectedConvId] = useState<string | null>(
        conventions.length === 1 ? conventions[0].id : null
    );

    if (!isOpen) return null;

    const targetConvention = conventions.find(c => c.id === selectedConvId);

    // Data prioritization logic (Tracking Teacher > Main Teacher)
    const getTeacherInfo = () => {
        if (!targetConvention) return null;

        const visit = targetConvention.visit;
        if (visit?.tracking_teacher_email) {
            return {
                name: `${visit.tracking_teacher_first_name || ''} ${visit.tracking_teacher_last_name || ''}`.trim() || 'Enseignant de suivi',
                email: visit.tracking_teacher_email,
                phone: null, // Phone not available in visit schema yet
                role: 'Enseignant chargé du suivi (PFMP)'
            };
        }

        return {
            name: targetConvention.prof_nom || 'Enseignant Référent',
            email: targetConvention.prof_email,
            phone: null, // Phone not available in standard schema
            role: 'Enseignant Référent / Professeur Principal'
        };
    };

    const teacher = getTeacherInfo();

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b bg-gray-50/50">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-100 p-2 rounded-lg">
                            <BookOpen className="w-6 h-6 text-indigo-600" />
                        </div>
                        <h3 className="font-bold text-xl text-gray-900 leading-tight">
                            Contacter l'établissement
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
                            className="w-full rounded-xl border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-3 bg-white text-gray-900 font-medium"
                        >
                            <option value="">-- Sélectionner un élève --</option>
                            {conventions.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.eleve_nom} {c.eleve_prenom} ({c.eleve_classe})
                                </option>
                            ))}
                        </select>
                    </div>

                    {targetConvention && teacher ? (
                        <div className="space-y-6 animate-in slide-in-from-top-4 duration-300">
                            {/* Teacher Card */}
                            <div className="bg-indigo-50/50 rounded-2xl p-5 border border-indigo-100">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="bg-white p-2 rounded-full shadow-sm">
                                        <User className="w-5 h-5 text-indigo-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-indigo-900">{teacher.name}</p>
                                        <p className="text-xs text-indigo-600 font-medium">{teacher.role}</p>
                                    </div>
                                </div>
                                
                                <div className="space-y-3">
                                    <a 
                                        href={`mailto:${teacher.email}`}
                                        className="flex items-center gap-3 p-3 bg-white hover:bg-indigo-50 rounded-xl border border-indigo-100 transition-colors group"
                                    >
                                        <Mail className="w-5 h-5 text-indigo-500 group-hover:scale-110 transition-transform" />
                                        <span className="text-sm font-medium text-gray-700 truncate">{teacher.email}</span>
                                        <ExternalLink className="w-3 h-3 text-gray-400 ml-auto" />
                                    </a>
                                    {teacher.phone && (
                                        <a 
                                            href={`tel:${teacher.phone}`}
                                            className="flex items-center gap-3 p-3 bg-white hover:bg-indigo-50 rounded-xl border border-indigo-100 transition-colors group"
                                        >
                                            <Phone className="w-5 h-5 text-indigo-500 group-hover:scale-110 transition-transform" />
                                            <span className="text-sm font-medium text-gray-700">{teacher.phone}</span>
                                            <ExternalLink className="w-3 h-3 text-gray-400 ml-auto" />
                                        </a>
                                    )}
                                </div>
                            </div>

                            {/* School Card */}
                            <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="bg-white p-2 rounded-full shadow-sm">
                                        <School className="w-5 h-5 text-gray-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-900">{targetConvention.ecole_nom}</p>
                                        <p className="text-xs text-gray-500 font-medium">{targetConvention.ecole_adresse}</p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <a 
                                        href={`tel:${targetConvention.ecole_tel}`}
                                        className="flex items-center gap-3 p-3 bg-white hover:bg-indigo-50 rounded-xl border border-gray-100 transition-colors group"
                                    >
                                        <Phone className="w-5 h-5 text-indigo-500 group-hover:scale-110 transition-transform" />
                                        <div className="flex flex-col">
                                            <span className="text-xs text-gray-400 font-medium leading-none mb-1">Standard</span>
                                            <span className="text-sm font-bold text-gray-700">{targetConvention.ecole_tel}</span>
                                        </div>
                                        <ExternalLink className="w-3 h-3 text-gray-400 ml-auto" />
                                    </a>
                                    <a 
                                        href={`mailto:${targetConvention.ecole_chef_email}`}
                                        className="flex items-center gap-3 p-3 bg-white hover:bg-indigo-50 rounded-xl border border-gray-100 transition-colors group"
                                    >
                                        <ShieldCheck className="w-5 h-5 text-indigo-500 group-hover:scale-110 transition-transform" />
                                        <div className="flex flex-col">
                                            <span className="text-xs text-gray-400 font-medium leading-none mb-1">Chef d'établissement / Administration</span>
                                            <span className="text-sm font-bold text-gray-700 truncate">{targetConvention.ecole_chef_email}</span>
                                        </div>
                                        <ExternalLink className="w-3 h-3 text-gray-400 ml-auto" />
                                    </a>
                                </div>
                            </div>
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
