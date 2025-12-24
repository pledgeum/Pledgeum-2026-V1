'use client';

import { useState, useEffect } from 'react';
import { X, GraduationCap, Search, Mail, Calendar, School, CheckSquare, Square, Send, ClipboardList, MessageSquare, Users } from 'lucide-react';
import { useConventionStore, Convention } from '@/store/convention';

interface AlumniModalProps {
    isOpen: boolean;
    onClose: () => void;
    authorizedSchoolName?: string; // To filter if we want, or just display context
}

// Mock Alumni Data - In a real app, this would come from a dedicated collection or archived conventions
const MOCK_ALUMNI = [
    { id: 'alu_1', prenom: 'Thomas', nom: 'Dubois', classe: 'T-SN', diplome: 'Bac Pro SN', promo: '2023', email: 'thomas.dubois@email.com', stage: 'Tech Solutions', job: 'Développeur Junior' },
    { id: 'alu_2', prenom: 'Marie', nom: 'Lefebvre', classe: 'T-MELEC', diplome: 'Bac Pro MELEC', promo: '2023', email: 'marie.lefebvre@email.com', stage: 'Elec Auto', job: 'Technicienne' },
    { id: 'alu_3', prenom: 'Lucas', nom: 'Martin', classe: 'T-SN', diplome: 'Bac Pro SN', promo: '2022', email: 'lucas.martin@email.com', stage: 'Web Agence', job: 'Freelance' },
    { id: 'alu_4', prenom: 'Emma', nom: 'Bernard', classe: 'T-GA', diplome: 'Bac Pro GA', promo: '2022', email: 'emma.bernard@email.com', stage: 'Compta & Co', job: 'Comptable' },
    { id: 'alu_5', prenom: 'Hugo', nom: 'Petit', classe: 'T-SN', diplome: 'Bac Pro SN', promo: '2023', email: 'hugo.petit@email.com', stage: 'CyberSec', job: 'Poursuite d\'études' },
];

export function AlumniModal({ isOpen, onClose, authorizedSchoolName }: AlumniModalProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedYear, setSelectedYear] = useState<string>('all');
    const [selectedClass, setSelectedClass] = useState<string>('all');

    const [selectedDiploma, setSelectedDiploma] = useState<string>('all');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Email Composer State
    const [isEmailComposerOpen, setIsEmailComposerOpen] = useState(false);
    const [emailSubject, setEmailSubject] = useState('');
    const [emailBody, setEmailBody] = useState('');

    if (!isOpen) return null;

    const filteredAlumni = MOCK_ALUMNI.filter(alumni => {
        const matchesSearch = (
            alumni.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
            alumni.prenom.toLowerCase().includes(searchTerm.toLowerCase()) ||
            alumni.stage.toLowerCase().includes(searchTerm.toLowerCase())
        );
        const matchesYear = selectedYear === 'all' || alumni.promo === selectedYear;
        const matchesClass = selectedClass === 'all' || alumni.classe === selectedClass;
        const matchesDiploma = selectedDiploma === 'all' || alumni.diplome === selectedDiploma;

        return matchesSearch && matchesYear && matchesClass && matchesDiploma;
    });

    const uniqueYears = Array.from(new Set(MOCK_ALUMNI.map(a => a.promo))).sort().reverse();
    const uniqueClasses = Array.from(new Set(MOCK_ALUMNI.map(a => a.classe))).sort();
    const uniqueDiplomas = Array.from(new Set(MOCK_ALUMNI.map(a => a.diplome))).sort();

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredAlumni.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredAlumni.map(a => a.id)));
        }
    };

    const handleSendEmail = () => {
        setIsEmailComposerOpen(true);
    };

    const submitEmail = () => {
        if (!emailSubject || !emailBody) {
            alert("Veuillez remplir l'objet et le message.");
            return;
        }
        alert(`Email envoyé avec succès à ${selectedIds.size} destinataires.\n\nObjet: ${emailSubject}`);
        setIsEmailComposerOpen(false);
        setEmailSubject('');
        setEmailBody('');
        setSelectedIds(new Set());
    };

    const handleSendSurvey = () => {
        alert(`Le sondage "Situation Professionnelle" a été envoyé à ${selectedIds.size} anciens élèves.\n\nLes réponses seront collectées individuellement dans l'onglet "Statistiques".`);
        setSelectedIds(new Set());
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-blue-900 text-white rounded-t-xl">
                    <div className="flex items-center space-x-3">
                        <div className="bg-white/20 p-2 rounded-full">
                            <GraduationCap className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold">Espace Alumni</h3>
                            <p className="text-xs text-blue-200">
                                {authorizedSchoolName ? `Réseau des anciens élèves - ${authorizedSchoolName}` : 'Réseau des anciens élèves'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-blue-200 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Filters */}
                <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-col gap-4">
                    {/* Search Bar */}
                    <div className="relative w-full">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Rechercher un ancien élève..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    {/* Dropdowns Row */}
                    <div className="flex flex-wrap gap-2">
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 bg-white min-w-[140px]"
                        >
                            <option value="all">Toutes promos</option>
                            {uniqueYears.map(year => (
                                <option key={year} value={year}>Promo {year}</option>
                            ))}
                        </select>

                        <select
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 bg-white min-w-[140px]"
                        >
                            <option value="all">Toutes classes</option>
                            {uniqueClasses.map(cls => (
                                <option key={cls} value={cls}>{cls}</option>
                            ))}
                        </select>

                        <select
                            value={selectedDiploma}
                            onChange={(e) => setSelectedDiploma(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 bg-white min-w-[160px]"
                        >
                            <option value="all">Tous diplômes</option>
                            {uniqueDiplomas.map(dip => (
                                <option key={dip} value={dip}>{dip}</option>
                            ))}
                        </select>

                        {(selectedYear !== 'all' || selectedClass !== 'all' || selectedDiploma !== 'all' || searchTerm) && (
                            <button
                                onClick={() => {
                                    setSearchTerm('');
                                    setSelectedYear('all');
                                    setSelectedClass('all');
                                    setSelectedDiploma('all');
                                }}
                                className="text-xs text-blue-600 hover:text-blue-800 underline ml-auto sm:ml-0"
                            >
                                Tout effacer
                            </button>
                        )}
                    </div>

                    {/* Bulk Actions Bar */}
                    <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg border border-blue-100">
                        <div className="flex items-center">
                            <button
                                onClick={toggleSelectAll}
                                className="flex items-center text-sm text-blue-800 font-medium hover:text-blue-900"
                            >
                                {selectedIds.size === filteredAlumni.length && filteredAlumni.length > 0 ? (
                                    <CheckSquare className="w-5 h-5 mr-2 text-blue-600" />
                                ) : (
                                    <Square className="w-5 h-5 mr-2 text-blue-400" />
                                )}
                                {selectedIds.size > 0 ? `${selectedIds.size} sélectionné(s)` : 'Tout sélectionner'}
                            </button>
                        </div>

                        {selectedIds.size > 0 && (
                            <div className="flex space-x-2">
                                <button
                                    onClick={handleSendEmail}
                                    className="flex items-center px-3 py-1.5 bg-white border border-blue-200 text-blue-700 text-sm font-bold rounded-lg hover:bg-blue-50 transition-colors shadow-sm"
                                >
                                    <Send className="w-4 h-4 mr-2" />
                                    Email
                                </button>
                                <button
                                    onClick={handleSendSurvey}
                                    className="flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                                >
                                    <ClipboardList className="w-4 h-4 mr-2" />
                                    Sondage
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1 bg-gray-50/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredAlumni.map((alumni) => (
                            <div key={alumni.id} className={`bg-white p-4 rounded-xl border transition-all ${selectedIds.has(alumni.id) ? 'border-blue-500 shadow-md ring-1 ring-blue-500' : 'border-gray-200 shadow-sm hover:shadow-md'}`}>
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center space-x-3">
                                        <button onClick={() => toggleSelection(alumni.id)} className="focus:outline-none">
                                            {selectedIds.has(alumni.id) ? (
                                                <CheckSquare className="w-5 h-5 text-blue-600" />
                                            ) : (
                                                <Square className="w-5 h-5 text-gray-300 hover:text-gray-400" />
                                            )}
                                        </button>
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                                            {alumni.prenom[0]}{alumni.nom[0]}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900">{alumni.prenom} {alumni.nom}</h4>
                                            <p className="text-xs text-gray-500">{alumni.job}</p>
                                        </div>
                                    </div>
                                    <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-md">
                                        Promo {alumni.promo}
                                    </span>
                                </div>

                                <div className="mt-4 space-y-2 text-sm text-gray-600">
                                    <div className="flex items-center">
                                        <School className="w-4 h-4 mr-2 text-gray-400" />
                                        <span>{alumni.diplome} ({alumni.classe})</span>
                                    </div>
                                    <div className="flex items-center">
                                        <div className="w-4 h-4 mr-2 flex items-center justify-center">🏢</div>
                                        <span>Ex-stagiaire chez <span className="font-medium text-gray-900">{alumni.stage}</span></span>
                                    </div>
                                </div>

                                <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
                                    <a
                                        href={`mailto:${alumni.email}`}
                                        className="flex items-center text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100"
                                    >
                                        <Mail className="w-3 h-3 mr-1" />
                                        Contacter
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>

                    {filteredAlumni.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            <GraduationCap className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                            <p>Aucun ancien élève trouvé pour cette recherche.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Email Composer Modal Overlay */}
            {isEmailComposerOpen && (
                <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full flex flex-col animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-blue-600 text-white rounded-t-xl">
                            <div className="flex items-center space-x-2">
                                <Mail className="w-5 h-5 text-white" />
                                <h3 className="text-lg font-bold">Nouveau message</h3>
                            </div>
                            <button onClick={() => setIsEmailComposerOpen(false)} className="text-blue-100 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800 flex items-center">
                                <Users className="w-4 h-4 mr-2" />
                                <span>À : <strong>{selectedIds.size} anciens élèves</strong> sélectionnés</span>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Objet</label>
                                <input
                                    type="text"
                                    value={emailSubject}
                                    onChange={(e) => setEmailSubject(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Ex: Invitation à la journée portes ouvertes"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                                <textarea
                                    value={emailBody}
                                    onChange={(e) => setEmailBody(e.target.value)}
                                    rows={8}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 font-sans"
                                    placeholder="Rédigez votre message ici..."
                                />
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3 rounded-b-xl">
                            <button
                                onClick={() => setIsEmailComposerOpen(false)}
                                className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={submitEmail}
                                className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 flex items-center shadow-sm"
                            >
                                <Send className="w-4 h-4 mr-2" />
                                Envoyer le message
                            </button>
                        </div>
                    </div>
                </div>
            )
            }
        </div >
    );
}
