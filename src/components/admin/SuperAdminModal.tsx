'use client';

import { useState } from 'react';
import { X, Search, ShieldCheck, MessageSquare, Trash2, Building2, User, Mail, Calendar } from 'lucide-react';
import { useAdminStore, SchoolStatus } from '@/store/admin';
import { useSchoolStore, Student } from '@/store/school'; // Import School Store
import { searchSchools, SchoolResult } from '@/lib/educationApi';

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

    const handleAuthorize = (school: SchoolResult, status: SchoolStatus) => {
        // 1. Authorize in Admin Store
        authorizeSchool({
            id: school.id,
            name: school.nom,
            city: school.ville,
            email: school.mail,
            status
        });

        // 2. Automate School Identity Population
        // This ensures the school is immediately ready with correct details
        useSchoolStore.getState().updateSchoolIdentity({
            schoolName: school.nom,
            schoolAddress: `${school.adresse}, ${school.cp} ${school.ville}`,
            schoolHeadEmail: school.mail || '', // Use official email as default for Head
            // Phone is likely not in this API result structure based on searchSchools, 
            // but if we had it we would map it. Step1School uses defaults anyway.
        });

        // Remove from search results to show it's done or just show "Déjà autorisé"
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
                                                <div className="flex items-center space-x-4">
                                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${school.status === 'BETA' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                                                        {school.status}
                                                    </span>
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
