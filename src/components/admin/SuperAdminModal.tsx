'use client';

import { useState, useEffect } from 'react';
import { X, Search, ShieldCheck, MessageSquare, Trash2, Building2, User, Mail, Calendar, Key } from 'lucide-react';
import { useAdminStore, SchoolStatus } from '@/store/admin';
import { useSchoolStore, Student } from '@/store/school'; // Import School Store
import { useUserStore } from '@/store/user';
import { searchSchools, SchoolResult } from '@/lib/educationApi';
import { initializeSchoolIdentity, sendWelcomeEmail, forceSandboxUserRole } from '@/app/actions/schoolAdmin';

interface SuperAdminModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function SuperAdminModal({ isOpen, onClose }: SuperAdminModalProps) {
    const [activeTab, setActiveTab] = useState<'schools' | 'feedbacks'>('schools');
    const { authorizedSchools, feedbacks, authorizeSchool, removeSchool } = useAdminStore();

    // Search State
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<SchoolResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);

    // Refresh list on open
    useEffect(() => {
        if (isOpen) {
            useAdminStore.getState().fetchAuthorizedSchools();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (searchTerm.length >= 3) {
            setIsSearching(true);
            try {
                const results = await searchSchools(searchTerm);
                setSearchResults(results);
            } finally {
                setIsSearching(false);
            }
        }
    };

    const handleAuthorize = async (school: SchoolResult, status: SchoolStatus) => {
        // 1. Authorize in Admin Store
        authorizeSchool({
            id: school.id,
            name: school.nom,
            city: school.ville,
            email: school.mail,
            status
        });

        // 2. Persist Identity to Server (Firestore)
        // This ensures the school is immediately ready with correct details on first login
        try {
            await initializeSchoolIdentity(school.id, {
                name: school.nom,
                address: school.adresse,
                city: school.ville,
                postalCode: school.cp,
                email: school.mail || '',
                status: status // Pass the status ('BETA' or 'ADHERENT')
                // phone not available in SchoolResult currently
            });

            // Update local store just in case
            useSchoolStore.getState().updateSchoolIdentity({
                schoolName: school.nom,
                schoolAddress: `${school.adresse}, ${school.cp} ${school.ville}`,
                schoolHeadEmail: school.mail || '',
            });
        } catch (error) {
            console.error("Failed to initialize school identity:", error);
            alert("Attention : L'école a été autorisée mais l'initialisation des données a échoué.");
        }
    };

    const handleSendEmail = async (school: any) => {
        if (!school.email) {
            alert("Cet établissement n'a pas d'email.");
            return;
        }
        if (!confirm(`Envoyer les identifiants à ${school.email} ?`)) return;

        setSendingEmailId(school.id);
        const result = await sendWelcomeEmail(school.id, school.email, school.name);
        setSendingEmailId(null);

        if (result.success) {
            alert("Email envoyé avec succès !");
        } else {
            alert("Erreur lors de l'envoi : " + result.error);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-purple-900 text-white rounded-t-xl">
                    <div className="flex items-center space-x-3">
                        <ShieldCheck className="w-6 h-6" />
                        <div>
                            <h3 className="text-xl font-bold">Administration PLEDGEUM</h3>
                            <p className="text-xs text-purple-200">Gestion des établissements et retours utilisateurs</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-purple-200 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200">
                    <button
                        onClick={() => setActiveTab('schools')}
                        className={`flex-1 py-4 text-sm font-medium flex items-center justify-center space-x-2 transition-colors ${activeTab === 'schools' ? 'text-purple-900 border-b-2 border-purple-900 bg-purple-50' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <Building2 className="w-4 h-4" />
                        <span>Établissements Autorisés</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('feedbacks')}
                        className={`flex-1 py-4 text-sm font-medium flex items-center justify-center space-x-2 transition-colors ${activeTab === 'feedbacks' ? 'text-purple-900 border-b-2 border-purple-900 bg-purple-50' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <MessageSquare className="w-4 h-4" />
                        <span>Suggestions & Problèmes ({feedbacks.length})</span>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto bg-gray-50 flex-1">
                    {activeTab === 'schools' ? (
                        <div className="space-y-8">


                            {/* Search */}
                            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">

                                {/* URGENT: FLASHY SANDBOX BUTTON FOR PLEDGEUM */}
                                {useUserStore.getState().email === 'pledgeum@gmail.com' && (
                                    <button
                                        type="button"
                                        className="relative z-[9999] bg-orange-600 hover:bg-orange-700 text-white font-bold text-lg p-4 block w-full mb-6 rounded-lg shadow-2xl border-4 border-white animate-pulse"
                                        onClick={async () => {
                                            if (!confirm("⚠️ Initialiser 'Mon LYCEE TOUTFAUX' en mode 'Coquille Vide' (Aucune donnée) et réparer Fabrice ?")) return;

                                            // 0. RESET STORES (Coquille Vide enforcement)
                                            // Wipe any localized data from persistence
                                            useSchoolStore.getState().reset();

                                            const sandboxSchool = {
                                                id: "9999999X",
                                                nom: "Mon LYCEE TOUTFAUX",
                                                ville: "Elbeuf",
                                                mail: "fabrice.dumasdelage@gmail.com",
                                                adresse: "12 Rue Ampère",
                                                cp: "76500"
                                            };

                                            const sandboxSchoolResult: SchoolResult = {
                                                id: sandboxSchool.id,
                                                nom: sandboxSchool.nom,
                                                ville: sandboxSchool.ville,
                                                cp: sandboxSchool.cp,
                                                adresse: sandboxSchool.adresse,
                                                mail: sandboxSchool.mail,
                                                type: "Lycée",
                                                lat: 0,
                                                lng: 0
                                            };

                                            // Authorize & Persist
                                            await handleAuthorize(sandboxSchoolResult, 'ADHERENT');

                                            // Persist Identity Explicitly
                                            await initializeSchoolIdentity(sandboxSchool.id, {
                                                name: sandboxSchool.nom,
                                                address: sandboxSchool.adresse,
                                                city: sandboxSchool.ville,
                                                postalCode: sandboxSchool.cp,
                                                email: sandboxSchool.mail,
                                                status: 'ADHERENT'
                                            });

                                            // Repair User
                                            await forceSandboxUserRole(sandboxSchool.mail);

                                            alert("✅ SANDBOX INITIALISÉE & RÉPARÉE");
                                            useAdminStore.getState().fetchAuthorizedSchools();
                                        }}
                                    >
                                        <div className="flex items-center justify-center gap-2">
                                            <ShieldCheck className="w-8 h-8" />
                                            <span>INITIALISER LE LYCÉE SANDBOX (TEST)</span>
                                        </div>
                                    </button>
                                )}

                                <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center">
                                    <Search className="w-4 h-4 mr-2 text-purple-600" />
                                    Ajouter un établissement
                                </h4>
                                <form onSubmit={handleSearch} className="flex gap-4">
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="Nom de l'établissement, ville ou code postal..."
                                        className="flex-1 text-sm border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                                    />
                                    <button
                                        type="submit"
                                        disabled={isSearching || searchTerm.length < 3}
                                        className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white text-sm font-bold py-2 px-6 rounded-md transition-colors"
                                    >
                                        Rechercher
                                    </button>
                                </form>
                                {/* Results */}
                                {searchResults.length > 0 && (
                                    <div className="mt-4 border-t border-gray-100 pt-4 max-h-60 overflow-y-auto">
                                        {searchResults.map((school) => {
                                            const isAuth = authorizedSchools.some(s => s.id === school.id);
                                            return (
                                                <div key={school.id} className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-lg">
                                                    <div>
                                                        <p className="font-bold text-sm text-gray-900">{school.nom}</p>
                                                        <p className="text-xs text-gray-500">{school.ville} ({school.cp})</p>
                                                        {school.mail && (
                                                            <p className="text-xs text-purple-600 flex items-center mt-0.5">
                                                                <Mail className="w-3 h-3 mr-1" />
                                                                {school.mail}
                                                            </p>
                                                        )}
                                                    </div>
                                                    {!isAuth ? (
                                                        <div className="flex space-x-2">
                                                            <button
                                                                onClick={() => handleAuthorize(school, 'BETA')}
                                                                className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded hover:bg-yellow-200"
                                                            >
                                                                Passer Beta-testeur
                                                            </button>
                                                            <button
                                                                onClick={() => handleAuthorize(school, 'ADHERENT')}
                                                                className="px-3 py-1 bg-green-100 text-green-800 text-xs font-bold rounded hover:bg-green-200"
                                                            >
                                                                Passer Adhérent
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded">Déjà autorisé</span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Authorized List */}
                            <div>
                                <h4 className="text-sm font-bold text-gray-900 mb-3">Établissements Autorisés ({authorizedSchools.length})</h4>
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden divide-y divide-gray-100">
                                    {authorizedSchools.length === 0 ? (
                                        <p className="p-8 text-center text-gray-500 italic">Aucun établissement autorisé.</p>
                                    ) : (
                                        authorizedSchools.map((school) => (
                                            <div key={school.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                                                <div className="flex items-center space-x-4">
                                                    <div className={`p-2 rounded-full ${school.status === 'BETA' ? 'bg-yellow-100' : 'bg-green-100'}`}>
                                                        <Building2 className={`w-5 h-5 ${school.status === 'BETA' ? 'text-yellow-600' : 'text-green-600'}`} />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-sm text-gray-900">{school.name}</p>
                                                        <div className="flex items-center space-x-2 text-xs text-gray-500">
                                                            <span>{school.city}</span>
                                                            {school.email && (
                                                                <>
                                                                    <span className="text-gray-300">•</span>
                                                                    <span className="flex items-center">
                                                                        <Mail className="w-3 h-3 mr-1" />
                                                                        {school.email}
                                                                    </span>
                                                                </>
                                                            )}
                                                            <span className="text-gray-300">•</span>
                                                            <span>Autorisé le {new Date(school.authorizedAt).toLocaleDateString()}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    {school.status === 'BETA' && (
                                                        <button
                                                            onClick={async () => {
                                                                if (confirm(`Passer ${school.name} en mode ADHÉRENT ?`)) {
                                                                    // Need to reconstruct SchoolResult-like object or modify handleAuthorize to accept partial
                                                                    // Since handleAuthorize expects SchoolResult, we map back or cast. 
                                                                    // Actually authorizeSchool just takes { id, name, ... }.
                                                                    // Let's see handleAuthorize signature in lines 40-72.
                                                                    // It takes (school: SchoolResult, status: SchoolStatus).
                                                                    // We need to pass a SchoolResult. The 'school' here is from authorizedSchools which might differ slightly or be just the store object.
                                                                    // The store object has { id, name, city, email, status, authorizedAt }
                                                                    // SchoolResult has { id, nom, ville, mail, ... }
                                                                    // We can construct a minimal compatible object if handleAuthorize uses it safely.
                                                                    // Looking at handleAuthorize:
                                                                    // It uses school.id, school.nom, school.ville, school.mail for authorizeSchool
                                                                    // and school.adresse, school.cp etc for initializeSchoolIdentity.
                                                                    // If we are just upgrading status, initializeSchoolIdentity might re-run nicely or check if exists.
                                                                    // Ideally we should just update the status in store if we assume identity is already fine.
                                                                    // BUT `authorizeSchool` in store might overwrite.
                                                                    // Let's try to just call authorizeSchool from store directly if we want to skip re-initialization overhead, 
                                                                    // OR better: Just update the status.

                                                                    // However, for simplicity and consistency with the "Authorize" flow which implies "Set this status", we can re-use logic if possible.
                                                                    // BUT `school` variable here is from `authorizedSchools` (store), NOT `searchResults` (API).
                                                                    // Store object lacks address/cp usually unless we stored them?
                                                                    // user.ts/admin.ts types:
                                                                    // AuthorizedSchool { id, name, city, email, status, authorizedAt }
                                                                    // It misses address/cp.
                                                                    // So calling `handleAuthorize` fully might fail on `initializeSchoolIdentity` (missing address).
                                                                    // So we should probably just call `authorizeSchool` from `useAdminStore` to update the status.

                                                                    authorizeSchool({
                                                                        id: school.id,
                                                                        name: school.name,
                                                                        city: school.city,
                                                                        email: school.email,
                                                                        status: 'ADHERENT'
                                                                    });
                                                                }
                                                            }}
                                                            className="px-2 py-1 bg-green-50 text-green-700 text-xs font-bold rounded hover:bg-green-100 border border-green-200 transition-colors mr-2"
                                                            title="Passer en mode Adhérent complet"
                                                        >
                                                            Passer Adhérent
                                                        </button>
                                                    )}
                                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${school.status === 'BETA' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                                                        {school.status}
                                                    </span>
                                                    <button
                                                        onClick={() => handleSendEmail(school)}
                                                        disabled={sendingEmailId === school.id}
                                                        className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-md transition-colors disabled:opacity-50"
                                                        title="Envoyer email de bienvenue (Identifiants)"
                                                    >
                                                        <Key className={`w-4 h-4 ${sendingEmailId === school.id ? 'animate-pulse' : ''}`} />
                                                    </button>
                                                    <button
                                                        onClick={() => removeSchool(school.id)}
                                                        className="text-gray-400 hover:text-red-500 transition-colors"
                                                        title="Révoquer l'accès"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Feedbacks List */}
                            {feedbacks.length === 0 ? (
                                <div className="p-12 text-center bg-white rounded-lg border border-dashed border-gray-300">
                                    <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                    <p className="text-gray-500 text-sm">Aucun retour utilisateur pour le moment.</p>
                                </div>
                            ) : (
                                feedbacks.map((fb) => (
                                    <div key={fb.id} className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center space-x-2">
                                                <span className={`px-2 py-0.5 rounded-md text-xs font-bold uppercase ${fb.type === 'BUG' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                                                    {fb.type === 'BUG' ? 'Problème' : 'Suggestion'}
                                                </span>
                                                <span className="text-xs text-gray-400 flex items-center">
                                                    <Calendar className="w-3 h-3 mr-1" />
                                                    {new Date(fb.createdAt).toLocaleDateString()} à {new Date(fb.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-bold text-gray-900">{fb.schoolName}</p>
                                            </div>
                                        </div>

                                        <p className="text-gray-800 text-sm whitespace-pre-wrap bg-gray-50 p-3 rounded-md mb-4">{fb.message}</p>

                                        <div className="flex items-center space-x-6 text-xs text-gray-500 border-t border-gray-100 pt-3">
                                            <div className="flex items-center space-x-1">
                                                <User className="w-3 h-3" />
                                                <span className="font-medium">{fb.userName}</span>
                                                <span className="text-gray-400">({fb.userRole})</span>
                                            </div>
                                            <div className="flex items-center space-x-1">
                                                <Mail className="w-3 h-3" />
                                                <a href={`mailto:${fb.userEmail}`} className="hover:text-purple-600 transition-colors">{fb.userEmail}</a>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
