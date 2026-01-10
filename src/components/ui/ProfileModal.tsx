"use client";

import React, { useState, useEffect } from 'react';
import { X, Save, User, Building2, MapPin, Phone, Briefcase, GraduationCap, Calendar, Mail, Users, ChevronDown, ChevronUp, School, Search, Loader2, CheckCircle } from 'lucide-react';
import { searchSchools, SchoolResult } from '@/lib/educationApi';
import { fetchCompanyBySiret } from '@/lib/companyApi';
import { useUserStore, UserRole } from '@/store/user';
import { Convention } from '@/store/convention';
import { useAuth } from '@/context/AuthContext';
import { CitySearchResults } from './CitySearchResults';
import { AddressAutocomplete } from './AddressAutocomplete';

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    conventionDefaults?: Convention;
    blocking?: boolean;
}

export function ProfileModal({ isOpen, onClose, conventionDefaults, blocking = false }: ProfileModalProps) {
    if (!isOpen) return null;

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
    const initializedRef = React.useRef(false); // Track if we've initialized for this open session

    useEffect(() => {
        if (isOpen) {
            if (initializedRef.current) return; // Already initialized, don't overwrite user edits

            initializedRef.current = true; // Mark as initialized

            const initialData: Record<string, string> = { ...profileData };

            // Helper to set default if empty
            const setDefault = (key: string, value?: string | number | null) => {
                if (!initialData[key] && value) {
                    initialData[key] = String(value);
                }
            };

            // Universal defaults
            // FORCE email to match Auth email (cannot be changed)
            if (user?.email) {
                initialData['email'] = user.email;
            }

            // Try to split name if available
            if (name && (!initialData.lastName || !initialData.firstName)) {
                const parts = name.split(' ');
                if (parts.length > 0) {
                    setDefault('firstName', parts[0]);
                    if (parts.length > 1) setDefault('lastName', parts.slice(1).join(' '));
                }
            }

            // Sync with new nested structure (Student)
            if (role === 'student') {
                // Address Object
                if (initialData.address && typeof initialData.address === 'object') {
                    const addr = initialData.address as any;
                    if (addr.street) initialData['address'] = addr.street;
                    if (addr.postalCode) initialData['zipCode'] = addr.postalCode;
                    if (addr.city) initialData['city'] = addr.city;
                }

                // Legal Representatives
                if (initialData.legalRepresentatives && Array.isArray(initialData.legalRepresentatives)) {
                    const reps = initialData.legalRepresentatives as any[];
                    if (reps.length > 0) {
                        const rep1 = reps[0];
                        if (rep1.firstName || rep1.lastName) initialData['parentName'] = `${rep1.firstName || ''} ${rep1.lastName || ''}`.trim();
                        if (rep1.email) initialData['parentEmail'] = rep1.email;
                        if (rep1.phone) initialData['parentPhone'] = rep1.phone;

                        // Parse rep1 address (object to string)
                        // Parse rep1 address (object to string)
                        if (rep1.address && typeof rep1.address === 'object') {
                            const a = rep1.address;
                            initialData['parentAddress'] = a.street || '';
                            initialData['parentZip'] = a.postalCode || '';
                            initialData['parentCity'] = a.city || '';
                        }

                        if (reps.length > 1) {
                            const rep2 = reps[1];
                            if (rep2.firstName || rep2.lastName) initialData['parent2Name'] = `${rep2.firstName || ''} ${rep2.lastName || ''}`.trim();
                            if (rep2.email) initialData['parent2Email'] = rep2.email;
                            if (rep2.phone) initialData['parent2Phone'] = rep2.phone;

                            if (rep2.address && typeof rep2.address === 'object') {
                                const a = rep2.address;
                                initialData['parent2Address'] = `${a.street || ''} ${a.postalCode || ''} ${a.city || ''}`.trim();
                            }
                        }
                    }
                }
            }

            // Map defaults based on role if convention exists
            if (conventionDefaults) {
                switch (role) {
                    case 'student':
                        setDefault('lastName', conventionDefaults?.eleve_nom);
                        setDefault('firstName', conventionDefaults?.eleve_prenom);

                        let bd = birthDate || conventionDefaults?.eleve_date_naissance;
                        // Convert DD/MM/YYYY to YYYY-MM-DD for input type="date"
                        if (bd && bd.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
                            const [d, m, y] = bd.split('/');
                            bd = `${y}-${m}-${d}`;
                        }
                        setDefault('birthDate', bd);

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
            if (role === 'student' && !initialData.schoolName) {
                // FALLBACK FOR TEST ACCOUNTS OR DATA ANOMALIES
                // If student has no school, assign a default "Admin-defined" school so they aren't stuck.
                initialData['schoolName'] = "Lycée Jean Jaurès (Test)";
                initialData['schoolAddress'] = "1 Rue de la République";
                initialData['schoolCity'] = "Paris";
                initialData['schoolZip'] = "75001";
            }

            setFormData(initialData);
        } else {
            // Reset initialization flag when closed
            initializedRef.current = false;
        }
    }, [isOpen, profileData, conventionDefaults, role, user]); // Added user dependency

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
        console.log("handleSave called");
        if (!user) {
            console.error("No user found");
            return;
        }

        console.log("Role:", role);
        console.log("Is Minor?", isMinor());
        console.log("Form Data:", formData);

        // Validation for Students (Mandatory Parent Info)
        if (role === 'student') {
            // Removed isMinor() check - Mandatory for ALL
            if (!formData.parentName || !formData.parentEmail || !formData.parentPhone || !formData.parentAddress || !formData.parentZip || !formData.parentCity) {
                alert("Vous devez obligatoirement renseigner les coordonnées complètes d'un responsable légal pour valider votre profil.");
                setShowParent(true);
                return;
            }
        }

        setLoading(true);
        try {
            const updates: Record<string, any> = { ...formData };

            // Sync back to nested structure (Student)
            if (role === 'student') {
                // Address
                if (updates.address || updates.zipCode || updates.city) {
                    updates['address'] = {
                        street: updates.address || '',
                        postalCode: updates.zipCode || '',
                        city: updates.city || ''
                    };
                }

                // Legal Representatives
                const currentReps = (profileData.legalRepresentatives as any[]) || [];
                const rep1 = currentReps[0] || { role: 'Responsable Légal 1' };

                // Parse Name
                const p1Name = updates.parentName || '';
                const p1Space = p1Name.indexOf(' ');
                if (p1Space > 0) {
                    rep1.firstName = p1Name.substring(0, p1Space);
                    rep1.lastName = p1Name.substring(p1Space + 1);
                } else {
                    rep1.lastName = p1Name;
                    rep1.firstName = '';
                }

                rep1.email = updates.parentEmail || '';
                rep1.phone = updates.parentPhone || '';

                // Address: Reconstruct from split fields
                // Logic: If user checked "Same Address", these fields should have been populated in UI state
                if (updates.parentAddress || updates.parentZip || updates.parentCity) {
                    rep1.address = {
                        street: updates.parentAddress || '',
                        postalCode: updates.parentZip || '',
                        city: updates.parentCity || ''
                    };
                } else if (updates.parentAddressStr) {
                    // Fallback if legacy string used (shouldn't happen with new UI)
                    rep1.address = { street: updates.parentAddressStr, postalCode: '', city: '' };
                }

                const newReps = [rep1];

                // Rep 2
                if (updates.parent2Name) {
                    const rep2 = currentReps[1] || { role: 'Responsable Légal 2' };
                    const p2Name = updates.parent2Name || '';
                    const p2Space = p2Name.indexOf(' ');
                    if (p2Space > 0) {
                        rep2.firstName = p2Name.substring(0, p2Space);
                        rep2.lastName = p2Name.substring(p2Space + 1);
                    } else {
                        rep2.lastName = p2Name;
                        rep2.firstName = '';
                    }
                    rep2.email = updates.parent2Email || '';
                    rep2.phone = updates.parent2Phone || '';

                    const oldAddrStr2 = rep2.address ? `${rep2.address.street || ''} ${rep2.address.postalCode || ''} ${rep2.address.city || ''}`.trim() : '';
                    if (updates.parent2Address && updates.parent2Address !== oldAddrStr2) {
                        rep2.address = { street: updates.parent2Address, postalCode: '', city: '' };
                    }
                    newReps.push(rep2);
                }

                updates['legalRepresentatives'] = newReps;
            }

            await updateProfileData(user.uid, updates);
            onClose();
        } catch (error: any) {
            console.error("Failed to save profile", error);
            alert(`Erreur lors de la sauvegarde : ${error.message || "Erreur inconnue"}`);
        } finally {
            setLoading(false);
        }
    };




    const renderField = (name: string, label: string, icon: React.ReactNode, type: string = "text", placeholder: string = "", disabled: boolean = false) => (
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
                disabled={disabled}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all ${disabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
            />
        </div>
    );

    // Minor Calculation
    const isMinor = () => {
        if (!formData.birthDate) return false;
        const birth = new Date(formData.birthDate);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        return age < 18;
    };

    // Auto-Show Parent if Student (implied mandatory)
    useEffect(() => {
        if (role === 'student' && !showParent && !formData.parentName) {
            // Only auto-open if likely empty to encourage fill
            setShowParent(true);
        }
    }, [role, showParent, formData.parentName]); // Run when minor status determined

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
                        <p className="text-white font-medium mt-1">
                            {name && name !== 'Compte Test Admin' ? `${name} - ` : ''}
                            {
                                role === 'student' ? 'Élève' :
                                    role === 'teacher' ? 'Enseignant' :
                                        role === 'company_head' ? "Chef d'Entreprise" :
                                            role === 'school_head' ? "Chef d'établissement scolaire" :
                                                role === 'ddfpt' ? "Directeur délégué à la formation professionnelle et technologique" :
                                                    role === 'tutor' ? 'Tuteur' : role
                            }
                        </p>
                    </div>
                    <button onClick={onClose} className={`text-white/80 hover:text-white transition-colors`}>
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">

                    {/* Common Fields */}
                    <div className="grid grid-cols-2 gap-4">
                        {renderField("lastName", "Nom", <User className="w-4 h-4" />, "text", "", ["student", "teacher", "teacher_tracker"].includes(role) && !!profileData.lastName)}
                        {renderField("firstName", "Prénom", <User className="w-4 h-4" />, "text", "", ["student", "teacher", "teacher_tracker"].includes(role) && !!profileData.firstName)}
                    </div>
                    {renderField("email", "Email (Identifiant)", <Mail className="w-4 h-4" />, "email", "", true)}
                    {renderField("phone", "Téléphone", <Phone className="w-4 h-4" />, "tel")}

                    <hr className="border-gray-100" />

                    {role === 'student' && (
                        <>
                            {renderField("birthDate", "Date de Naissance (Non modifiable, contactez l'administration)", <Calendar className="w-4 h-4" />, "date", "", true)}
                            <AddressAutocomplete
                                label="Adresse Personnelle"
                                value={{
                                    street: formData.address || '',
                                    postalCode: formData.zipCode || '',
                                    city: formData.city || ''
                                }}
                                onChange={(addr) => {
                                    setFormData(prev => ({
                                        ...prev,
                                        address: addr.street,
                                        zipCode: addr.postalCode,
                                        city: addr.city
                                    }));
                                }}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                {renderField("zipCode", "Code Postal", <MapPin className="w-4 h-4" />)}
                                {renderField("city", "Ville", <MapPin className="w-4 h-4" />)}
                            </div>
                            {renderField("class", "Classe", <GraduationCap className="w-4 h-4" />, "text", "", true)}
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
                                                {/* Only allow removing school if NOT a student (Admins/Teachers might need to change it, but students are assigned) */}
                                                {role !== 'student' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData(prev => ({ ...prev, schoolName: '', schoolAddress: '', schoolLat: '', schoolLng: '' }))}
                                                        className="absolute top-2 right-2 text-blue-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                )}
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


                                        <div className="pt-2 border-t border-blue-100 mt-2">
                                            <div className="flex items-center gap-2 mb-2">
                                                <input
                                                    type="checkbox"
                                                    id="sameAddress"
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                parentAddress: prev.address || '',
                                                                parentZip: prev.zipCode || '',
                                                                parentCity: prev.city || ''
                                                            }));
                                                        }
                                                    }}
                                                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                                />
                                                <label htmlFor="sameAddress" className="text-sm text-gray-600">Même adresse que l'élève</label>
                                            </div>

                                            <AddressAutocomplete
                                                label="Adresse Parent"
                                                value={{
                                                    street: formData.parentAddress || '',
                                                    postalCode: formData.parentZip || '',
                                                    city: formData.parentCity || ''
                                                }}
                                                onChange={(addr) => {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        parentAddress: addr.street,
                                                        parentZip: addr.postalCode,
                                                        parentCity: addr.city
                                                    }));
                                                }}
                                            />
                                            <div className="grid grid-cols-2 gap-4 mt-2">
                                                {renderField("parentZip", "Code Postal", <MapPin className="w-4 h-4" />)}
                                                {renderField("parentCity", "Ville", <MapPin className="w-4 h-4" />)}
                                            </div>
                                        </div>
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
                            className={`px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors`}
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
