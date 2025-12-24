import React, { useState, useEffect } from 'react';
import { X, Save, User, Building2, MapPin, Phone, Briefcase, GraduationCap, Calendar, Mail, Users, ChevronDown, ChevronUp, School, Search, Loader2, CheckCircle } from 'lucide-react';
import { searchSchools, SchoolResult } from '@/lib/educationApi';
import { fetchCompanyBySiret } from '@/lib/companyApi';
import { useUserStore, UserRole } from '@/store/user';
import { Convention } from '@/store/convention';
import { useAuth } from '@/context/AuthContext';
import { CitySearchResults } from './CitySearchResults';

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    conventionDefaults?: Convention;
}

export function ProfileModal({ isOpen, onClose, conventionDefaults }: ProfileModalProps) {
    const { user, logout } = useAuth();
    const { role, profileData, updateProfileData, name, birthDate } = useUserStore();
    const [formData, setFormData] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [showParent, setShowParent] = useState(false);
    const [showParent2, setShowParent2] = useState(false);
    // School Search State
    const [schoolQuery, setSchoolQuery] = useState('');
    const [cityQuery, setCityQuery] = useState('');
    const [schoolResults, setSchoolResults] = useState<SchoolResult[]>([]);
    const [isSearchingSchool, setIsSearchingSchool] = useState(false);
    const [showSchoolResults, setShowSchoolResults] = useState(false);
    const [isSearchingSiret, setIsSearchingSiret] = useState(false);

    // Initialize form data
    useEffect(() => {
        if (isOpen) {
            const initialData: Record<string, string> = { ...profileData };

            // Helper to set default if empty
            const setDefault = (key: string, value?: string | number | null) => {
                if (!initialData[key] && value) {
                    initialData[key] = String(value);
                }
            };

            // Universal defaults
            setDefault('email', user?.email);

            // Try to split name if available
            if (name && (!initialData.lastName || !initialData.firstName)) {
                const parts = name.split(' ');
                if (parts.length > 0) {
                    setDefault('firstName', parts[0]);
                    if (parts.length > 1) setDefault('lastName', parts.slice(1).join(' '));
                }
            }

            // Map defaults based on role if convention exists
            if (conventionDefaults) {
                switch (role) {
                    case 'student':
                        setDefault('lastName', conventionDefaults?.eleve_nom);
                        setDefault('firstName', conventionDefaults?.eleve_prenom);
                        setDefault('birthDate', birthDate || conventionDefaults?.eleve_date_naissance);
                        setDefault('address', conventionDefaults?.eleve_adresse);
                        setDefault('phone', conventionDefaults?.eleve_tel);
                        setDefault('class', conventionDefaults?.eleve_classe);
                        setDefault('diploma', conventionDefaults?.diplome_intitule);
                        break;
                    case 'company_head':
                    case 'company_head_tutor':
                        setDefault('companyName', conventionDefaults.ent_nom);
                        setDefault('siret', conventionDefaults.ent_siret);
                        setDefault('address', conventionDefaults.ent_adresse);
                        setDefault('function', conventionDefaults.ent_rep_fonction);
                        break;
                    case 'tutor':
                        setDefault('function', conventionDefaults.tuteur_fonction);
                        break;
                    case 'parent':
                        setDefault('address', conventionDefaults.rep_legal_adresse);
                        break;
                    case 'teacher':
                        break;
                }
            }
            setFormData(initialData);
        }
    }, [isOpen, profileData, conventionDefaults, role]);

    // School Search Effect
    useEffect(() => {
        const search = async () => {
            if (schoolQuery.length > 2 || cityQuery.length > 2) {
                setIsSearchingSchool(true);
                try {
                    const results = await searchSchools(schoolQuery, cityQuery);
                    setSchoolResults(results);
                    setShowSchoolResults(true);
                } catch (error) {
                    console.error("School search failed", error);
                } finally {
                    setIsSearchingSchool(false);
                }
            } else {
                setSchoolResults([]);
                setShowSchoolResults(false);
            }
        };
        const timeoutId = setTimeout(search, 500);
        return () => clearTimeout(timeoutId);
    }, [schoolQuery, cityQuery]);

    // SIRET Search Effect
    useEffect(() => {
        const fetchCompany = async () => {
            const siret = formData.siret;
            const cleanSiret = siret ? siret.replace(/\s/g, '') : '';
            if (cleanSiret.length === 14 && !isNaN(Number(cleanSiret))) {
                setIsSearchingSiret(true);
                try {
                    const company = await fetchCompanyBySiret(cleanSiret);
                    if (company) {
                        setFormData(prev => ({
                            ...prev,
                            companyName: company.nom_complet,
                            address: company.adresse,
                            siret: company.siret
                        }));
                    }
                } catch (err) {
                    console.error(err);
                } finally {
                    setIsSearchingSiret(false);
                }
            }
        };
        fetchCompany();
    }, [formData.siret]);

    const handleSelectSchool = (school: SchoolResult) => {
        setFormData(prev => ({
            ...prev,
            schoolName: school.nom,
            schoolAddress: `${school.adresse}, ${school.cp} ${school.ville}`,
            schoolCity: school.ville,
            schoolZip: school.cp,
            schoolLat: String(school.lat),
            schoolLng: String(school.lng)
        }));
        setSchoolQuery('');
        setCityQuery('');
        setShowSchoolResults(false);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setLoading(true);
        try {
            await updateProfileData(user.uid, formData);
            onClose();
        } catch (error) {
            console.error("Failed to save profile", error);
        } finally {
            setLoading(false);
        }
    };


    if (!isOpen) return null;

    const renderField = (name: string, label: string, icon: React.ReactNode, type: string = "text", placeholder: string = "") => (
        <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                {icon}
                {label}
            </label>
            <input
                type={type}
                name={name}
                value={formData[name] || ''}
                onChange={handleChange}
                placeholder={placeholder}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <User className="h-6 w-6" />
                            Mon Profil
                        </h2>
                        <p className="text-white font-medium mt-1">{name} - {
                            role === 'student' ? 'Élève' :
                                role === 'teacher' ? 'Enseignant' :
                                    role === 'company_head' ? "Chef d'Entreprise" :
                                        role === 'tutor' ? 'Tuteur' : role
                        }</p>
                    </div>
                    <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">

                    {/* Common Fields */}
                    <div className="grid grid-cols-2 gap-4">
                        {renderField("lastName", "Nom", <User className="w-4 h-4" />)}
                        {renderField("firstName", "Prénom", <User className="w-4 h-4" />)}
                    </div>
                    {renderField("email", "Email", <Mail className="w-4 h-4" />, "email")}
                    {renderField("phone", "Téléphone", <Phone className="w-4 h-4" />, "tel")}

                    <hr className="border-gray-100" />

                    {role === 'student' && (
                        <>
                            {renderField("birthDate", "Date de Naissance", <Calendar className="w-4 h-4" />, "date")}
                            {renderField("address", "Adresse Personnelle", <MapPin className="w-4 h-4" />)}
                            <div className="grid grid-cols-2 gap-4">
                                {renderField("zipCode", "Code Postal", <MapPin className="w-4 h-4" />)}
                                {renderField("city", "Ville", <MapPin className="w-4 h-4" />)}
                            </div>
                            {renderField("class", "Classe", <GraduationCap className="w-4 h-4" />)}
                            {renderField("diploma", "Diplôme Préparé", <GraduationCap className="w-4 h-4" />)}

                            {/* Section École (Moved Up) */}
                            <div className="pt-2">
                                <div className="border border-gray-200 rounded-lg overflow-visible bg-white relative z-10">
                                    <div className="bg-gray-50 p-3 flex items-center gap-2 font-medium text-gray-900 border-b border-gray-200">
                                        <School className="w-5 h-5 text-gray-500" />
                                        Mon Établissement Scolaire
                                    </div>

                                    <div className="p-4 space-y-4">
                                        {formData.schoolName ? (
                                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 relative group">
                                                <h4 className="font-semibold text-blue-900">{formData.schoolName}</h4>
                                                <p className="text-sm text-blue-700">{formData.schoolAddress}</p>
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData(prev => ({ ...prev, schoolName: '', schoolAddress: '', schoolLat: '', schoolLng: '' }))}
                                                    className="absolute top-2 right-2 text-blue-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="space-y-3 relative">
                                                <p className="text-sm text-gray-500">Recherchez votre établissement.</p>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="text-xs font-medium text-gray-500">Ville</label>
                                                        <input
                                                            type="text"
                                                            value={cityQuery}
                                                            onChange={(e) => setCityQuery(e.target.value)}
                                                            placeholder="Ex: Lyon"
                                                            className="w-full px-3 py-2 border rounded text-sm"
                                                        />
                                                    </div>
                                                    <div className="relative">
                                                        <label className="text-xs font-medium text-gray-500">Nom de l'école</label>
                                                        <div className="relative">
                                                            <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
                                                            <input
                                                                type="text"
                                                                value={schoolQuery}
                                                                onChange={(e) => {
                                                                    setSchoolQuery(e.target.value);
                                                                    setShowSchoolResults(true);
                                                                }}
                                                                placeholder="Ex: Jules Ferry"
                                                                className="w-full pl-8 pr-3 py-2 border rounded text-sm"
                                                            />
                                                            {isSearchingSchool && <Loader2 className="absolute right-2 top-2.5 w-4 h-4 animate-spin text-blue-500" />}
                                                        </div>

                                                        {/* Results Dropdown */}
                                                        {showSchoolResults && schoolResults.length > 0 && (
                                                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
                                                                {schoolResults.map((school) => (
                                                                    <button
                                                                        key={school.id}
                                                                        type="button"
                                                                        onClick={() => handleSelectSchool(school)}
                                                                        className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm border-b border-gray-100 last:border-0"
                                                                    >
                                                                        <div className="font-medium text-gray-900">{school.nom}</div>
                                                                        <div className="text-xs text-gray-500">{school.ville} ({school.type})</div>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowParent(!showParent)}
                                    className="w-full flex items-center justify-between p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-100 group"
                                    title="Cliquez pour voir/modifier les coordonnées"
                                >
                                    <div className="flex items-center gap-2 font-medium text-blue-900">
                                        <Users className="w-4 h-4" />
                                        <span>
                                            {formData.parentName ? `Responsable : ${formData.parentName}` : "Ajouter un responsable légal"}
                                        </span>
                                    </div>
                                    {showParent ? <ChevronUp className="w-4 h-4 text-blue-500" /> : <ChevronDown className="w-4 h-4 text-blue-500" />}
                                </button>

                                {showParent && (
                                    <div className="mt-3 space-y-3 pl-2 border-l-2 border-blue-100 animate-in slide-in-from-top-2">
                                        {renderField("parentName", "Nom Prénom", <User className="w-4 h-4" />)}
                                        {renderField("parentEmail", "Email Parent", <Mail className="w-4 h-4" />, "email")}
                                        {renderField("parentPhone", "Téléphone Parent", <Phone className="w-4 h-4" />, "tel")}
                                        {renderField("parentAddress", "Adresse Parent", <MapPin className="w-4 h-4" />)}
                                    </div>
                                )}
                            </div>

                            <div className="pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowParent2(!showParent2)}
                                    className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-100 group"
                                    title="Ajouter un second responsable (optionnel)"
                                >
                                    <div className="flex items-center gap-2 font-medium text-gray-700">
                                        <Users className="w-4 h-4" />
                                        <span>
                                            {formData.parent2Name ? `2ème Responsable : ${formData.parent2Name}` : "Ajouter un 2ème responsable (Optionnel)"}
                                        </span>
                                    </div>
                                    {showParent2 ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                                </button>

                                {showParent2 && (
                                    <div className="mt-3 space-y-3 pl-2 border-l-2 border-gray-200 animate-in slide-in-from-top-2">
                                        {renderField("parent2Name", "Nom Prénom (2)", <User className="w-4 h-4" />)}
                                        {renderField("parent2Email", "Email (2)", <Mail className="w-4 h-4" />, "email")}
                                        {renderField("parent2Phone", "Téléphone (2)", <Phone className="w-4 h-4" />, "tel")}
                                        {renderField("parent2Address", "Adresse (2)", <MapPin className="w-4 h-4" />)}
                                    </div>
                                )}
                            </div>

                        </>
                    )}

                    {(role === 'company_head' || role === 'company_head_tutor') && (
                        <>
                            {renderField("companyName", "Raison Sociale", <Building2 className="w-4 h-4" />)}
                            <div className="space-y-1 relative">
                                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                    <Building2 className="w-4 h-4" />
                                    Numéro SIRET
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        name="siret"
                                        value={formData.siret || ''}
                                        onChange={handleChange}
                                        maxLength={14}
                                        placeholder="1234..."
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all pr-10"
                                    />
                                    {isSearchingSiret && (
                                        <div className="absolute right-3 top-2.5">
                                            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                        </div>
                                    )}
                                </div>
                            </div>
                            {renderField("address", "Adresse de l'Entreprise", <MapPin className="w-4 h-4" />)}
                            {renderField("function", "Fonction du Signataire", <Briefcase className="w-4 h-4" />)}
                        </>
                    )}

                    {role === 'tutor' && (
                        <>
                            {renderField("function", "Fonction", <Briefcase className="w-4 h-4" />)}
                        </>
                    )}

                    {role === 'parent' && (
                        <>
                            {renderField("address", "Adresse", <MapPin className="w-4 h-4" />)}
                        </>
                    )}

                    {(role === 'teacher' || role === 'teacher_tracker') && (
                        <div className="space-y-3 pt-2 border-t border-gray-100">
                            <h3 className="font-medium text-gray-900 flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-blue-600" />
                                Préférences de Suivi
                            </h3>
                            <p className="text-xs text-gray-500">
                                Renseignez une commune de proximité pour vous voir proposer des élèves proches de ce lieu (ex: Domicile).
                            </p>

                            <div className="relative">
                                <label className="text-sm font-medium text-gray-700 mb-1 block">Commune de proximité</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        value={formData.preferredCity || cityQuery}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setFormData(prev => ({ ...prev, preferredCity: val })); // Allow manual type
                                            setCityQuery(val); // Trigger search
                                        }}
                                        placeholder="Rechercher une commune..."
                                        className="w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                    {(cityQuery.length > 2 && !formData.preferredCityLat) && (
                                        <div className="absolute right-3 top-2.5">
                                            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                        </div>
                                    )}
                                </div>

                                {/* Results Dropdown (Inline implementation for now) */}
                                {cityQuery.length > 2 && !formData.preferredCityLat && (
                                    <CitySearchResults
                                        query={cityQuery}
                                        onSelect={(city) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                preferredCity: city.name,
                                                preferredCityZip: city.postcode,
                                                preferredCityLat: String(city.lat),
                                                preferredCityLon: String(city.lon)
                                            }));
                                            setCityQuery('');
                                        }}
                                    />
                                )}

                                {formData.preferredCity && formData.preferredCityLat && (
                                    <div className="mt-2 text-xs text-green-600 flex items-center gap-1 bg-green-50 p-2 rounded border border-green-100">
                                        <CheckCircle className="w-3 h-3" />
                                        Localisation validée : {formData.preferredCity} ({formData.preferredCityZip})
                                        <button
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, preferredCity: '', preferredCityLat: '', preferredCityLon: '', preferredCityZip: '' }))}
                                            className="ml-auto text-gray-400 hover:text-red-500"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Fallback / Common fields if needed */}
                    {!['student', 'company_head', 'company_head_tutor', 'tutor', 'parent'].includes(role) && (
                        <div className="text-center text-gray-500 italic py-4">
                            {/* Only common fields are shown */}
                        </div>
                    )}

                </form>

                {/* Footer */}
                <div className="p-4 bg-gray-50 border-t flex flex-col gap-4">
                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Annuler
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white font-bold rounded-full shadow-lg hover:bg-blue-700 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Enregistrement...' : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Enregistrer
                                </>
                            )}
                        </button>
                    </div>

                    {/* RGPD / Delete Account */}
                </div>
            </div>
        </div>
    );
}
