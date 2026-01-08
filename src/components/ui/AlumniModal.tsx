'use client';

import { useState, useEffect } from 'react';
import { X, GraduationCap, Search, Mail, Calendar, School, CheckSquare, Square, Send, ClipboardList, MessageSquare, Users, Loader2 } from 'lucide-react';
import { useConventionStore, Convention } from '@/store/convention';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { sendNotification } from '@/lib/notification';

interface AlumniModalProps {
    isOpen: boolean;
    onClose: () => void;
    authorizedSchoolName?: string; // To filter if we want, or just display context
}

// Mock Alumni Data - In a real app, this would come from a dedicated collection or archived conventions
const MOCK_ALUMNI = [
    { id: 'Alu7x9s2k4m5vJ8nB3rW', prenom: 'Thomas', nom: 'Dubois', classe: 'T-SN', diplome: 'Bac Pro SN', promo: '2023', email: 'pledgeum@gmail.com', stage: 'Tech Solutions', job: 'Développeur Junior', date_naissance: '15/05/2005', lycee: 'Lycée Polyvalent Gustave Eiffel', ville: 'Armentières' },
    { id: 'Alu8nB3rWaL9zX2mK7pQ', prenom: 'Marie', nom: 'Lefebvre', classe: 'T-MELEC', diplome: 'Bac Pro MELEC', promo: '2023', email: 'marie.lefebvre@email.com', stage: 'Elec Auto', job: 'Technicienne', date_naissance: '22/11/2004', lycee: 'Lycée Polyvalent Gustave Eiffel', ville: 'Armentières' },
    { id: 'AluWaL9zX2mK7pQ4vJ8n', prenom: 'Lucas', nom: 'Martin', classe: 'T-SN', diplome: 'Bac Pro SN', promo: '2022', email: 'lucas.martin@email.com', stage: 'Web Agence', job: 'Freelance', date_naissance: '10/02/2004', lycee: 'Lycée Polyvalent Gustave Eiffel', ville: 'Armentières' },
    { id: 'AluX2mK7pQ4vJ8nB3rWa', prenom: 'Emma', nom: 'Bernard', classe: 'T-GA', diplome: 'Bac Pro GA', promo: '2022', email: 'emma.bernard@email.com', stage: 'Compta & Co', job: 'Comptable', date_naissance: '30/08/2004', lycee: 'Lycée Polyvalent Gustave Eiffel', ville: 'Armentières' },
    { id: 'Alu4vJ8nB3rWaL9zX2mK', prenom: 'Hugo', nom: 'Petit', classe: 'T-SN', diplome: 'Bac Pro SN', promo: '2023', email: 'hugo.petit@email.com', stage: 'CyberSec', job: 'Poursuite d\'études', date_naissance: '12/12/2005', lycee: 'Lycée Polyvalent Gustave Eiffel', ville: 'Armentières' },
];

const LEGACY_ID_MAP: Record<string, string> = {
    'Alu7x9s2k4m5vJ8nB3rW': 'alu_1',
    'Alu8nB3rWaL9zX2mK7pQ': 'alu_2',
    'AluWaL9zX2mK7pQ4vJ8n': 'alu_3',
    'AluX2mK7pQ4vJ8nB3rWa': 'alu_4',
    'Alu4vJ8nB3rWaL9zX2mK': 'alu_5',
};

export function AlumniModal({ isOpen, onClose, authorizedSchoolName }: AlumniModalProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedYear, setSelectedYear] = useState<string>('all');
    const [selectedClass, setSelectedClass] = useState<string>('all');

    const [selectedDiploma, setSelectedDiploma] = useState<string>('all');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [sending, setSending] = useState(false);

    // Live Alumni Data
    const [alumniList, setAlumniList] = useState(MOCK_ALUMNI);

    useEffect(() => {
        const fetchAlumniUpdates = async () => {
            if (!isOpen) return;
            try {
                const querySnapshot = await getDocs(collection(db, "alumni"));
                const updates: Record<string, any> = {};
                querySnapshot.forEach((doc) => {
                    updates[doc.id] = doc.data();
                });

                if (Object.keys(updates).length > 0) {
                    setAlumniList(prevList => prevList.map(alumni => {
                        // Check for update on new ID OR legacy ID
                        const update = updates[alumni.id] || updates[LEGACY_ID_MAP[alumni.id]];
                        if (update) {
                            // Merge updates, prioritizing Firestore data for dynamic fields
                            return { ...alumni, ...update };
                        }
                        return alumni;
                    }));
                }
            } catch (error) {
                console.error("Error fetching alumni updates:", error);
            }
        };

        if (isOpen) {
            fetchAlumniUpdates();
        }
    }, [isOpen]);

    // Email Composer State
    const [isEmailComposerOpen, setIsEmailComposerOpen] = useState(false);
    const [emailSubject, setEmailSubject] = useState('');
    const [emailBody, setEmailBody] = useState('');

    if (!isOpen) return null;

    if (!isOpen) return null;

    const normalizeText = (text: string) =>
        text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const filteredAlumni = alumniList.filter(alumni => {
        const fullName = `${alumni.prenom} ${alumni.nom}`;
        const reverseName = `${alumni.nom} ${alumni.prenom}`;

        const searchNorm = normalizeText(searchTerm);
        const fullNorm = normalizeText(fullName);
        const reverseNorm = normalizeText(reverseName);
        const nomNorm = normalizeText(alumni.nom);
        const prenomNorm = normalizeText(alumni.prenom);
        const stageNorm = normalizeText(alumni.stage);
        const companyNorm = (alumni as any).companyName ? normalizeText((alumni as any).companyName) : '';

        const matchesSearch = (
            fullNorm.includes(searchNorm) ||
            reverseNorm.includes(searchNorm) ||
            nomNorm.includes(searchNorm) ||
            prenomNorm.includes(searchNorm) ||
            stageNorm.includes(searchNorm) ||
            (companyNorm && companyNorm.includes(searchNorm))
        );
        const matchesYear = selectedYear === 'all' || alumni.promo === selectedYear;
        const matchesClass = selectedClass === 'all' || alumni.classe === selectedClass;
        const matchesDiploma = selectedDiploma === 'all' || alumni.diplome === selectedDiploma;

        return matchesSearch && matchesYear && matchesClass && matchesDiploma;
    });

    const uniqueYears = Array.from(new Set(alumniList.map((a: any) => a.promo))).sort().reverse();
    const uniqueClasses = Array.from(new Set(alumniList.map((a: any) => a.classe))).sort();
    const uniqueDiplomas = Array.from(new Set(alumniList.map((a: any) => a.diplome))).sort();

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

    const submitEmail = async () => {
        if (!emailSubject || !emailBody) {
            alert("Veuillez remplir l'objet et le message.");
            return;
        }

        setSending(true);
        let sentCount = 0;

        for (const id of Array.from(selectedIds)) {
            const alumni = alumniList.find((a: any) => a.id === id);
            if (alumni && alumni.email) {
                // If testing with pledgeum@gmail.com, we might want to override? 
                // But generally we send to alumni.email. 
                // The user can edit the mock data or assumes the system works.
                // However, user specifically said they didn't receive it on their test box.
                // Maybe they expect a copy? 
                // Or maybe they are "Thomas Dubois" in their mind?
                // Let's just send to the email.
                await sendNotification(alumni.email, emailSubject, emailBody);
                sentCount++;
            }
        }

        setSending(false);
        alert(`Email envoyé avec succès à ${sentCount} destinataires.`);
        setIsEmailComposerOpen(false);
        setEmailSubject('');
        setEmailBody('');
        setSelectedIds(new Set());
    };

    const handleSendSurvey = async () => {
        setSending(true);
        let sentCount = 0;
        const surveySubject = "Enquête : Que devenez-vous ?";
        const appUrl = window.location.origin; // Get current base URL
        const surveyBody = (prenom: string, id: string) => `Bonjour ${prenom},\n\nVotre ancien établissement souhaite avoir de vos nouvelles. Merci de prendre 2 minutes pour répondre à ce court sondage sur votre situation actuelle.\n\n${appUrl}/alumni-sondage?id=${id}\n\nCordialement,\nL'équipe administrative.`;

        for (const id of Array.from(selectedIds)) {
            const alumni = alumniList.find((a: any) => a.id === id);
            if (alumni && alumni.email) {
                await sendNotification(alumni.email, surveySubject, surveyBody(alumni.prenom, alumni.id));
                sentCount++;
            }
        }
        setSending(false);
        alert(`Le sondage "Situation Professionnelle" a été envoyé à ${sentCount} anciens élèves.`);
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
                                    disabled={sending}
                                    className="flex items-center px-3 py-1.5 bg-white border border-blue-200 text-blue-700 text-sm font-bold rounded-lg hover:bg-blue-50 transition-colors shadow-sm disabled:opacity-50"
                                >
                                    <Send className="w-4 h-4 mr-2" />
                                    Email
                                </button>
                                <button
                                    onClick={handleSendSurvey}
                                    disabled={sending}
                                    className="flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                                >
                                    {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ClipboardList className="w-4 h-4 mr-2" />}
                                    {sending ? 'Envoi...' : 'Sondage'}
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
                                    <div className="flex items-start">
                                        <div className="w-4 h-4 mr-2 mt-0.5 flex items-center justify-center">
                                            {(alumni as any).isContinuingStudies ? <GraduationCap className="w-4 h-4" /> : '🏢'}
                                        </div>
                                        <div className="flex flex-col">
                                            <span>
                                                {(alumni as any).isContinuingStudies ? (
                                                    <>
                                                        <span className="block font-medium text-blue-700">Étudiant - {(alumni as any).studyProgram || 'Etudes Supérieures'}</span>
                                                        {(alumni as any).isEmployed && (
                                                            <span className="text-gray-600 text-sm block mt-1">
                                                                Et en poste chez <span className="font-medium">{(alumni as any).companyName}</span>
                                                            </span>
                                                        )}
                                                    </>
                                                ) : (alumni as any).isEmployed ? (
                                                    <>En poste chez <span className="font-medium text-gray-900">{(alumni as any).companyName || alumni.stage}</span></>
                                                ) : (
                                                    <>Ex-stagiaire chez <span className="font-medium text-gray-900">{alumni.stage}</span></>
                                                )}
                                            </span>

                                            {/* Company Details (SIRET/City) - Only if employed */}
                                            {((alumni as any).isEmployed && (alumni as any).siret) && (
                                                <span className="text-xs text-gray-500 mt-0.5">
                                                    SIRET: {(alumni as any).siret}
                                                </span>
                                            )}
                                            {((alumni as any).isEmployed && (alumni as any).companyAddress) && (
                                                <span className="text-xs text-gray-500">
                                                    {/* Extract City if possible, or show full address */}
                                                    {(alumni as any).companyAddress}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Status Badges */}
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {(alumni as any).isOpenToInterns && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                                <CheckSquare className="w-3 h-3 mr-1" />
                                                Prend des stagiaires
                                            </span>
                                        )}
                                        {(alumni as any).isLookingForJob && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                                                <Search className="w-3 h-3 mr-1" />
                                                En recherche d'emploi
                                            </span>
                                        )}
                                        {(alumni as any).updatedAt && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200" title={`Mis à jour le ${new Date((alumni as any).updatedAt).toLocaleDateString()}`}>
                                                <Calendar className="w-3 h-3 mr-1" />
                                                Maj: {new Date((alumni as any).updatedAt).toLocaleDateString()}
                                            </span>
                                        )}
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
                                disabled={sending}
                                className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 flex items-center shadow-sm disabled:opacity-50"
                            >
                                {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                                {sending ? 'Envoi...' : 'Envoyer le message'}
                            </button>
                        </div>
                    </div>
                </div>
            )
            }
        </div >
    );
}
