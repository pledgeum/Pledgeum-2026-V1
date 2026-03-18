'use client';

import { z } from 'zod';
import { StepWrapper } from './StepWrapper';
import { conventionSchema } from '@/types/schema';
import { useWizardStore } from '@/store/wizard';
import { useSchoolStore } from '@/store/school';
import { useUserStore } from '@/store/user';
import { useState, useEffect } from 'react';
import { searchSchools, SchoolResult } from '@/lib/educationApi';
import { Search, MapPin, Loader2, Wand2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// Extract relevant fields for this step
const stepSchema = conventionSchema.pick({
    type: true,
    ecole_nom: true,
    ecole_adresse: true,
    ecole_tel: true,
    ecole_chef_nom: true,
    ecole_chef_email: true,
    prof_nom: true,
    prof_email: true,
    ecole_lat: true,
    ecole_lng: true,
    schoolId: true,
});



type Step1Data = z.infer<typeof stepSchema>;

export function Step1School() {
    const { setData, nextStep } = useWizardStore();
    const { profileData, role, email, uai: userUai } = useUserStore();
    const { allowedConventionTypes, schoolName, schoolAddress, schoolPhone, schoolHeadName, schoolHeadEmail, classes, fetchSchoolData } = useSchoolStore();
    const [cityQuery, setCityQuery] = useState('');
    const [schoolQuery, setSchoolQuery] = useState('');
    const [results, setResults] = useState<SchoolResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);

    useEffect(() => {
        const timer = setTimeout(async () => {
            if (schoolQuery.length > 2 || (cityQuery.length > 2 && schoolQuery.length > 0)) {
                setLoading(true);
                const res = await searchSchools(schoolQuery, cityQuery);
                setResults(res);
                setLoading(false);
                setShowResults(true);
            } else {
                setResults([]);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [schoolQuery, cityQuery]);

    const handleSelectSchool = (school: SchoolResult, form: any) => {
        form.setValue('ecole_nom', school.nom);
        form.setValue('ecole_adresse', `${school.adresse}, ${school.cp} ${school.ville}`);
        if (school.lat) form.setValue('ecole_lat', school.lat);
        if (school.lng) form.setValue('ecole_lng', school.lng);
        if (school.id) form.setValue('schoolId', school.id);
        setSchoolQuery(school.nom); // Update search box to match
        setShowResults(false);
    };

    const handleNext = (data: Step1Data) => {
        setData(data);
        nextStep();
    };

    return (
        <StepWrapper<Step1Data>
            title="L'Établissement Scolaire"
            description="Informations concernant le lycée."
            schema={stepSchema}
            onNext={handleNext}
        >
            {(form) => {
                // Compute derived state for Teacher Locking
                const studentClass = role === 'student' ? (profileData.class || profileData.classe) : null;
                // Use reactive 'classes' from the hook above
                const targetClass = studentClass ? classes.find(c => c.id === studentClass || c.name === studentClass) : null;
                const lockedMainTeacher = targetClass?.mainTeacher;

                // Explicit Lock for School Data (Student view OR Demo mode)
                // We treat 'demo_access@pledgeum.fr' as a student to demonstrate the UI locking
                const isSchoolLocked = role === 'student' || email === 'pledgeum@gmail.com' || email === 'demo_access@pledgeum.fr';

                // DEBUG: Inspect Store State for Step 1 Issue
                console.log("[Step1School] Debug:", {
                    schoolName,
                    schoolAddress,
                    isSchoolLocked,
                    role,
                    email
                });

                useEffect(() => {
                    const syncSchoolData = async () => {
                        // 1. Identify UAI from Profile (Source of Truth)
                        const uai = userUai || (profileData as any).uai || (profileData as any).schoolId || '';
                        console.log("CONVENTION_DEBUG: UAI trouvé =", uai);

                        // Only fetch/overwrite if we are in a locked mode (Student) or if the form is empty
                        // if (!isSchoolLocked && form.getValues('ecole_nom')) return; 
                        // Note: For students (isSchoolLocked), we ALWAYS run this to ensure correctness.

                        let fetchedData: any = null;

                        // 2. Handle Sandbox / Legacy
                        // Normalize 'global-school' or explicit Sandbox UAI
                        // 2. Fetch School Data (Postgres API) AND Refresh Classes
                        if (uai) {
                            try {
                                // Parallel Fetch: Identity + Classes (to ensure Main Teacher email is fresh)
                                const [identityRes] = await Promise.all([
                                    fetch(`/api/establishments/${uai}`),
                                    // fetchSchoolData(uai) // REMOVED to prevent infinite loop here. Handled below.
                                ]);

                                if (identityRes.ok) {
                                    const data = await identityRes.json();
                                    fetchedData = {
                                        name: data.name,
                                        address: data.address,
                                        zipCode: data.postalCode || data.zipCode, // Fix: Capture Zip
                                        city: data.city, // Fix: Capture City
                                        phone: data.phone || data.telephone,
                                        // Use generic head name/email if currently set, but School Head override below takes precedence
                                        headName: data.headName || "Proviseur",
                                        email: data.headEmail || data.admin_email
                                    };
                                }
                            } catch (err) {
                                console.error("CONVENTION_DEBUG: Error fetching school from API", err);
                            }
                        }

                        // [NEW] BUGFIX: Priority to User Profile for School Head
                        // If the current user IS the school head, use their real identity instead of School/Sandbox defaults.
                        if (role === 'school_head' && profileData) {
                            const realName = `${profileData.firstName || ''} ${profileData.lastName || ''}`.trim();
                            const realEmail = email || (profileData as any).email;

                            console.log("CONVENTION_DEBUG: User is School Head. Overriding defaults with:", { realName, realEmail });

                            if (!fetchedData) fetchedData = {};

                            if (realName) {
                                fetchedData.headName = realName;
                                // Ensure we clear conflicting fields to avoid '||' precedence issues downstream if needed, 
                                // but 'headName' is first in the chain below, so setting it is enough.
                            }
                            if (realEmail) {
                                fetchedData.email = realEmail;
                                // 'email' is first in chain: fetchedData.email || ...
                            }
                        }

                        console.log("CONVENTION_DEBUG: Données reçues (Final) =", fetchedData);

                        // 3. Apply Data
                        if (fetchedData) {
                            // Map Firestore 'schools' schema to Wizard Form
                            // We handle multiple potential field names from the DB schema
                            const name = fetchedData.name || fetchedData.schoolName;
                            // FIX: Concatenate Address
                            const street = fetchedData.address || fetchedData.schoolAddress || fetchedData.street || '';
                            const zip = fetchedData.zipCode || '';
                            const city = fetchedData.city || '';
                            const address = street && (zip || city) ? `${street} ${zip} ${city}`.trim() : street;
                            const phone = fetchedData.phone || fetchedData.schoolPhone;
                            const headName = fetchedData.headName || fetchedData.principalName || fetchedData.schoolHeadName;
                            const headEmail = fetchedData.email || fetchedData.adminEmail || fetchedData.schoolHeadEmail;

                            // Force update if locked, or if empty
                            if (isSchoolLocked || !form.getValues('ecole_nom')) {
                                if (name) form.setValue('ecole_nom', name);
                                if (address) form.setValue('ecole_adresse', address);
                                if (phone) form.setValue('ecole_tel', phone);
                                if (headName) form.setValue('ecole_chef_nom', headName);
                                if (headEmail) form.setValue('ecole_chef_email', headEmail);
                                if (uai) form.setValue('schoolId', uai);
                            }
                        } else if (schoolName && (!form.getValues('ecole_nom') || isSchoolLocked)) {
                            // Fallback to Store if direct fetch returned nothing (e.g. invalid UAI) but Store has data
                            // This covers cases where 'uai' might be missing but 'schoolName' is in store.
                            form.setValue('ecole_nom', schoolName);
                            if (schoolAddress) form.setValue('ecole_adresse', schoolAddress);
                            if (schoolPhone) form.setValue('ecole_tel', schoolPhone);
                            if (schoolHeadName) form.setValue('ecole_chef_nom', schoolHeadName);
                            if (schoolHeadEmail) form.setValue('ecole_chef_email', schoolHeadEmail);
                            if (userUai || (profileData as any).uai) form.setValue('schoolId', userUai || (profileData as any).uai);
                        }
                    };

                    syncSchoolData();

                    // Auto-fill Teacher if locked (Keep existing logic)
                    if (lockedMainTeacher) {
                        form.setValue('prof_nom', `${lockedMainTeacher.firstName} ${lockedMainTeacher.lastName}`);

                        // FIX: Only pre-fill and lock if the email is a REAL email
                        const email = lockedMainTeacher.email || '';
                        const isGhost = email.startsWith('teacher-') || email.includes('@pledgeum.temp');

                        if (!isGhost) {
                            form.setValue('prof_email', email);
                        }
                    }
                }, [form, isSchoolLocked, profileData, schoolName, schoolAddress, schoolPhone, schoolHeadName, schoolHeadEmail, lockedMainTeacher]);

                // [NEW] Separate Side Effect for Data Fetching to avoid Infinite Loops
                // Compute UAI outside to use in dependency array
                const computedUai = userUai || (profileData as any).uai || (profileData as any).schoolId;

                useEffect(() => {
                    if (computedUai) {
                        console.log("[Step1School] Triggering fresh Class Data fetch for UAI:", computedUai);
                        fetchSchoolData(computedUai);
                    }
                }, [computedUai, fetchSchoolData]); // Stable dependencies

                // Helper to determine if we should lock the email field
                const isEmailLocked = !!lockedMainTeacher &&
                    !((lockedMainTeacher.email || '').startsWith('teacher-')) &&
                    !((lockedMainTeacher.email || '').includes('@pledgeum.temp'));


    const [allowedTypes, setAllowedTypes] = useState<{ id: string, label: string }[]>([]);
    const [isFetchingTypes, setIsFetchingTypes] = useState(false);

    // Fetch allowed types based on UAI and ClassID
    useEffect(() => {
        const uai = userUai || (profileData as any).uai || (profileData as any).schoolId;
        const classId = (profileData as any).classId || (profileData as any).classe;

        if (role === 'student' && uai && classId) {
            const fetchAllowedTypes = async () => {
                setIsFetchingTypes(true);
                try {
                    const res = await fetch(`/api/student/conventions/allowed-types?uai=${uai}&classId=${classId}`);
                    if (res.ok) {
                        const data = await res.json();
                        setAllowedTypes(data.allowedTypes || []);
                        
                        // Auto-select if only one type
                        if (data.allowedTypes?.length === 1) {
                            form.setValue('type', data.allowedTypes[0].id as any);
                        }
                    }
                } catch (error) {
                    console.error("Error fetching allowed types:", error);
                } finally {
                    setIsFetchingTypes(false);
                }
            };
            fetchAllowedTypes();
        }
    }, [role, userUai, profileData, form]);

                return (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        {/* Convention Type Configuration */}
                        {role === 'student' ? (
                            // Student View: Dynamic selection based on allowed types
                            allowedTypes.length > 1 ? (
                                <div className="md:col-span-2 bg-indigo-50 p-6 rounded-2xl border border-indigo-100 mb-4 animate-in fade-in slide-in-from-top-4 duration-500">
                                    <h4 className="flex items-center text-indigo-900 font-bold mb-3 text-lg">
                                        <Wand2 className="w-5 h-5 mr-2 text-indigo-600" />
                                        Quel type de stage effectuez-vous ?
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {allowedTypes.map((type) => (
                                            <label 
                                                key={type.id}
                                                className={cn(
                                                    "relative flex items-center p-4 cursor-pointer rounded-xl border-2 transition-all duration-200",
                                                    form.watch('type') === type.id 
                                                        ? "border-indigo-600 bg-white shadow-md ring-2 ring-indigo-100" 
                                                        : "border-gray-200 bg-gray-50/50 hover:border-indigo-300 hover:bg-white"
                                                )}
                                            >
                                                <input
                                                    type="radio"
                                                    {...form.register('type')}
                                                    value={type.id}
                                                    className="sr-only"
                                                />
                                                <div className="flex flex-col">
                                                    <span className={cn(
                                                        "font-bold text-sm",
                                                        form.watch('type') === type.id ? "text-indigo-900" : "text-gray-700"
                                                    )}>
                                                        {type.label}
                                                    </span>
                                                    <span className="text-xs text-gray-500 mt-0.5">
                                                        Modèle de convention officiel
                                                    </span>
                                                </div>
                                                {form.watch('type') === type.id && (
                                                    <div className="ml-auto">
                                                        <div className="h-5 w-5 rounded-full bg-indigo-600 flex items-center justify-center">
                                                            <div className="h-2 w-2 rounded-full bg-white" />
                                                        </div>
                                                    </div>
                                                )}
                                            </label>
                                        ))}
                                    </div>
                                    <p className="text-xs text-indigo-600 mt-4 flex items-center">
                                        <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
                                        Le choix du type détermine le texte juridique de votre convention.
                                    </p>
                                    {form.formState.errors.type && (
                                        <p className="text-xs text-red-600 mt-2 font-bold flex items-center animate-pulse">
                                            <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
                                            {form.formState.errors.type.message || "Veuillez sélectionner un type de convention"}
                                        </p>
                                    )}
                                </div>
                            ) : (
                                // Single type or fetching: Informative alert
                                <div className="md:col-span-2 bg-gray-50 p-4 rounded-xl border border-gray-200 mb-2">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Type de Convention</p>
                                            <p className="text-sm font-bold text-gray-900">
                                                {isFetchingTypes ? "Chargement..." : (allowedTypes[0]?.label || "PFMP Lycée Professionnel (Standard)")}
                                            </p>
                                        </div>
                                        {!isFetchingTypes && (
                                            <div className="px-2.5 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded-full border border-green-200 uppercase">
                                                Auto-configuré
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        ) : (
                            // Admin / Teacher View: Full selection with development status
                            <div className="md:col-span-2 bg-indigo-50 p-4 rounded-xl border border-indigo-100 mb-2">
                                <label className="block text-sm font-bold text-indigo-900 mb-2">Type de Convention</label>
                                <select
                                    {...form.register('type')}
                                    className="block w-full rounded-md border-gray-400 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 sm:text-sm p-2 bg-white text-gray-900 disabled:opacity-100 disabled:text-gray-900"
                                >
                                    <option value="PFMP_STANDARD" disabled={allowedConventionTypes && !allowedConventionTypes.includes('PFMP_STANDARD')}>
                                        PFMP Lycée Professionnel (Standard) {allowedConventionTypes && !allowedConventionTypes.includes('PFMP_STANDARD') && '(Non activé)'}
                                    </option>
                                    <option value="STAGE_SECONDE" disabled={allowedConventionTypes && !allowedConventionTypes.includes('STAGE_SECONDE')}>
                                        Stage de Seconde {allowedConventionTypes && !allowedConventionTypes.includes('STAGE_SECONDE') && '(En cours de développement)'}
                                    </option>
                                    <option value="ERASMUS_MOBILITY" disabled={allowedConventionTypes && !allowedConventionTypes.includes('ERASMUS_MOBILITY')}>
                                        Mobilité Erasmus+ {allowedConventionTypes && !allowedConventionTypes.includes('ERASMUS_MOBILITY') && '(En cours de développement)'}
                                    </option>
                                </select>
                                <p className="text-xs text-indigo-600 mt-1">
                                    Le choix du type détermine le format légal de la convention générée. Les options grisées sont en cours de développement ou désactivées par votre établissement.
                                </p>
                            </div>
                        )}

                        {/* Search School - Check if NOT locked (so not student and not debug account) */}
                        {!isSchoolLocked && (
                            <div className="md:col-span-2 bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4">
                                <h4 className="flex items-center text-blue-900 font-semibold mb-3">
                                    <Search className="w-4 h-4 mr-2" />
                                    Recherche Rapide de l'Établissement
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-blue-800 mb-1">Ville</label>
                                        <input
                                            type="text"
                                            value={cityQuery}
                                            onChange={(e) => setCityQuery(e.target.value)}
                                            placeholder="Ex: Lyon"
                                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 sm:text-sm p-2 placeholder:text-gray-500 text-gray-900"
                                        />
                                    </div>
                                    <div className="relative">
                                        <label className="block text-xs font-medium text-blue-800 mb-1">Nom de l'école</label>
                                        <input
                                            type="text"
                                            value={schoolQuery}
                                            onChange={(e) => {
                                                setSchoolQuery(e.target.value);
                                                setShowResults(true);
                                            }}
                                            placeholder="Ex: Jules Ferry"
                                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 sm:text-sm p-2 placeholder:text-gray-500 text-gray-900"
                                        />
                                        {loading && (
                                            <div className="absolute right-2 top-8">
                                                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                            </div>
                                        )}
                                        {showResults && results.length > 0 && (
                                            <div className="absolute z-10 w-full bg-white mt-1 rounded-md shadow-lg border border-gray-200 max-h-60 overflow-y-auto">
                                                {results.map((school) => (
                                                    <button
                                                        key={school.id}
                                                        type="button"
                                                        onClick={() => handleSelectSchool(school, form)}
                                                        className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm border-b border-gray-100 last:border-0"
                                                    >
                                                        <div className="font-medium text-gray-900">{school.nom}</div>
                                                        <div className="text-xs text-gray-700 flex items-center">
                                                            <MapPin className="w-3 h-3 mr-1" />
                                                            {school.ville} ({school.type})
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Nom de l'établissement (Vérifiez)</label>
                            <input
                                {...form.register('ecole_nom')}
                                type="text"
                                disabled={isSchoolLocked}
                                readOnly={isSchoolLocked}
                                style={isSchoolLocked ? { opacity: 1, WebkitTextFillColor: '#111827', color: '#111827' } : {}}
                                className={cn(
                                    "mt-1 block w-full rounded-md border-gray-400 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 sm:text-sm p-2 border text-gray-900 placeholder:text-gray-500 disabled:opacity-100 disabled:text-gray-900 read-only:text-gray-900",
                                    isSchoolLocked && "bg-gray-50 text-gray-900 border-gray-400 cursor-not-allowed",
                                    form.formState.errors.ecole_nom && "border-red-500 focus:border-red-500 focus:ring-red-500"
                                )}
                            />
                            {form.formState.errors.ecole_nom && <p className="text-red-500 text-xs mt-1">{form.formState.errors.ecole_nom.message}</p>}
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Adresse complète</label>
                            <textarea
                                {...form.register('ecole_adresse')}
                                rows={2}
                                disabled={isSchoolLocked}
                                readOnly={isSchoolLocked}
                                style={isSchoolLocked ? { opacity: 1, WebkitTextFillColor: '#111827', color: '#111827' } : {}}
                                className={cn(
                                    "mt-1 block w-full rounded-md border-gray-400 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 sm:text-sm p-2 border text-gray-900 placeholder:text-gray-500 disabled:opacity-100 disabled:text-gray-900 read-only:text-gray-900",
                                    isSchoolLocked && "bg-gray-50 text-gray-900 border-gray-400 cursor-not-allowed",
                                    form.formState.errors.ecole_adresse && "border-red-500 focus:border-red-500 focus:ring-red-500"
                                )}
                            />
                            {form.formState.errors.ecole_adresse && <p className="text-red-500 text-xs mt-1">{form.formState.errors.ecole_adresse.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Téléphone standard</label>
                            <input
                                {...form.register('ecole_tel')}
                                type="tel"
                                disabled={isSchoolLocked}
                                readOnly={isSchoolLocked}
                                style={isSchoolLocked ? { opacity: 1, WebkitTextFillColor: '#111827', color: '#111827' } : {}}
                                className={cn(
                                    "mt-1 block w-full rounded-md border-gray-400 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 sm:text-sm p-2 border text-gray-900 placeholder:text-gray-500 disabled:opacity-100 disabled:text-gray-900 read-only:text-gray-900",
                                    isSchoolLocked && "bg-gray-50 text-gray-900 border-gray-400 cursor-not-allowed",
                                    form.formState.errors.ecole_tel && "border-red-500 focus:border-red-500 focus:ring-red-500"
                                )}
                            />
                        </div>

                        <div className="hidden md:block"></div> {/* Spacer */}

                        <div className="md:col-span-2 border-t pt-4 mt-2">
                            <h3 className="text-sm font-semibold text-gray-900 mb-4">Représentant de l'établissement</h3>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Nom du Chef d'Établissement scolaire</label>
                            <input
                                {...form.register('ecole_chef_nom')}
                                type="text"
                                disabled={isSchoolLocked}
                                readOnly={isSchoolLocked}
                                style={isSchoolLocked ? { opacity: 1, WebkitTextFillColor: '#111827', color: '#111827' } : {}}
                                className={cn(
                                    "mt-1 block w-full rounded-md border-gray-400 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 sm:text-sm p-2 border text-gray-900 placeholder:text-gray-500 disabled:opacity-100 disabled:text-gray-900 read-only:text-gray-900",
                                    isSchoolLocked && "bg-gray-50 text-gray-900 border-gray-400 cursor-not-allowed",
                                    form.formState.errors.ecole_chef_nom && "border-red-500 focus:border-red-500 focus:ring-red-500"
                                )}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Email (pour signature)</label>
                            <input
                                {...form.register('ecole_chef_email')}
                                type="email"
                                disabled={isSchoolLocked}
                                readOnly={isSchoolLocked}
                                style={isSchoolLocked ? { opacity: 1, WebkitTextFillColor: '#111827', color: '#111827' } : {}}
                                className={cn(
                                    "mt-1 block w-full rounded-md border-gray-400 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 sm:text-sm p-2 border text-gray-900 placeholder:text-gray-500 disabled:opacity-100 disabled:text-gray-900 read-only:text-gray-900",
                                    isSchoolLocked && "bg-gray-50 text-gray-900 border-gray-400 cursor-not-allowed",
                                    form.formState.errors.ecole_chef_email && "border-red-500 focus:border-red-500 focus:ring-red-500"
                                )}
                            />
                            {form.formState.errors.ecole_chef_email && <p className="text-red-500 text-xs mt-1">{form.formState.errors.ecole_chef_email.message}</p>}
                        </div>

                        <div className="md:col-span-2 border-t pt-4 mt-2">
                            <h3 className="text-sm font-semibold text-gray-900 mb-4">Suivi Pédagogique</h3>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Enseignant Référent/Professeur Principal</label>
                            <input
                                {...form.register('prof_nom')}
                                type="text"
                                disabled={!!lockedMainTeacher}
                                className={cn(
                                    "mt-1 block w-full rounded-md border-gray-400 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 sm:text-sm p-2 border text-gray-900 placeholder:text-gray-500 disabled:opacity-100 disabled:text-gray-900 read-only:text-gray-900",
                                    !!lockedMainTeacher && "bg-gray-50 text-gray-900 border-gray-400 cursor-not-allowed",
                                    form.formState.errors.prof_nom && "border-red-500 focus:border-red-500 focus:ring-red-500"
                                )}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Email Référent</label>
                            <input
                                {...form.register('prof_email')}
                                type="email"
                                disabled={isEmailLocked}
                                className={cn(
                                    "mt-1 block w-full rounded-md border-gray-400 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 sm:text-sm p-2 border text-gray-900 placeholder:text-gray-500 disabled:opacity-100 disabled:text-gray-900 read-only:text-gray-900",
                                    isEmailLocked && "bg-gray-50 text-gray-900 border-gray-400 cursor-not-allowed",
                                    form.formState.errors.prof_email && "border-red-500 focus:border-red-500 focus:ring-red-500"
                                )}
                            />
                        </div>

                    </div>
                );
            }}
        </StepWrapper>
    );
}
