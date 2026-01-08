'use client';

import { useState, useEffect } from 'react';
import { Building2, CheckCircle, Search, Briefcase, GraduationCap, ArrowRight, Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export default function AlumniSurveyPage() {
    const searchParams = useSearchParams();
    // In a real app, we'd verify a token from the URL to identify the alumni
    // const alumniId = searchParams.get('id'); 

    // Alumni Data State
    const [alumniData, setAlumniData] = useState<any>(null);

    // Mock Data Fallback (for demo purposes when Firestore doc doesn't exist yet)
    const MOCK_DATA_FALLBACK: Record<string, any> = {
        'Alu7x9s2k4m5vJ8nB3rW': { prenom: 'Thomas', nom: 'Dubois', date_naissance: '15/05/2005', lycee: 'Lycée Polyvalent Gustave Eiffel', ville: 'Armentières' },
        'Alu8nB3rWaL9zX2mK7pQ': { prenom: 'Marie', nom: 'Lefebvre', date_naissance: '22/11/2004', lycee: 'Lycée Polyvalent Gustave Eiffel', ville: 'Armentières' },
        'AluWaL9zX2mK7pQ4vJ8n': { prenom: 'Lucas', nom: 'Martin', date_naissance: '10/02/2004', lycee: 'Lycée Polyvalent Gustave Eiffel', ville: 'Armentières' },
        'AluX2mK7pQ4vJ8nB3rWa': { prenom: 'Emma', nom: 'Bernard', date_naissance: '30/08/2004', lycee: 'Lycée Polyvalent Gustave Eiffel', ville: 'Armentières' },
        'Alu4vJ8nB3rWaL9zX2mK': { prenom: 'Hugo', nom: 'Petit', date_naissance: '12/12/2005', lycee: 'Lycée Polyvalent Gustave Eiffel', ville: 'Armentières' },
    };

    const alumniId = searchParams.get('id');

    useEffect(() => {
        const fetchAlumni = async () => {
            if (!alumniId) return;
            try {
                // Try fetching from Firestore first
                const docRef = doc(db, 'alumni', alumniId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    setAlumniData(docSnap.data());
                } else {
                    // Fallback to mock data if not found (Demo Flow)
                    const mock = MOCK_DATA_FALLBACK[alumniId];
                    if (mock) {
                        setAlumniData(mock);
                    }
                }
            } catch (error) {
                console.error("Error fetching alumni:", error);
                // Fallback on error too
                const mock = MOCK_DATA_FALLBACK[alumniId];
                if (mock) setAlumniData(mock);
            }
        };
        fetchAlumni();
    }, [alumniId]);

    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    // Form State
    const [isEmployed, setIsEmployed] = useState<boolean | null>(null);
    const [companyName, setCompanyName] = useState('');
    const [companyAddress, setCompanyAddress] = useState('');
    const [siret, setSiret] = useState('');
    const [jobTitle, setJobTitle] = useState('');
    const [isOpenToInterns, setIsOpenToInterns] = useState<boolean | null>(null);

    // Unemployed State
    const [isLookingForJob, setIsLookingForJob] = useState<boolean | null>(null);
    const [jobSearchField, setJobSearchField] = useState('');
    const [interestedInOffers, setInterestedInOffers] = useState<boolean | null>(null);

    // Studies State
    const [isContinuingStudies, setIsContinuingStudies] = useState<boolean | null>(null);
    const [studyProgram, setStudyProgram] = useState('');

    // Company Search State
    const [searchingCompany, setSearchingCompany] = useState(false);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [showResults, setShowResults] = useState(false);

    const handleCompanySearch = async (query: string) => {
        setCompanyName(query);
        if (query.length < 3) {
            setSearchResults([]);
            setShowResults(false);
            return;
        }

        setSearchingCompany(true);
        try {
            // Use the government API directly or via our proxy if needed. 
            // Using public API for client-side simplicity in this demo, usually verified via server.
            const response = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(query)}&per_page=5`);
            const data = await response.json();
            setSearchResults(data.results || []);
            setShowResults(true);
        } catch (error) {
            console.error("Search error", error);
        } finally {
            setSearchingCompany(false);
        }
    };

    const selectCompany = (company: any) => {
        setCompanyName(company.nom_complet);
        setCompanyAddress(company.adresse || company.siege?.adresse || '');
        setSiret(company.siret || company.siege?.siret || '');
        setShowResults(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const alumniId = searchParams.get('id');

        // Determine main job status for list view
        let jobDisplay = isEmployed ? jobTitle : (isLookingForJob ? 'En recherche d\'emploi' : 'Sans activité');
        if (isContinuingStudies) {
            jobDisplay = `Étudiant - ${studyProgram}`;
            if (isEmployed) jobDisplay += ` (En poste)`;
        }

        const surveyData = {
            isEmployed,
            companyName,
            companyAddress,
            siret,
            jobTitle,
            isOpenToInterns,
            isLookingForJob: isEmployed === false ? isLookingForJob : null,
            jobSearchField: isEmployed === false ? jobSearchField : null,
            interestedInOffers: isEmployed === false ? interestedInOffers : null,
            isContinuingStudies,
            studyProgram: isContinuingStudies ? studyProgram : null,
            updatedAt: new Date().toISOString(),
            // Update main profile fields for list view
            stage: isEmployed ? companyName : (isContinuingStudies ? 'Études' : ''),
            job: jobDisplay,
            // Ensure basic info is kept if strictly creating a new doc (unlikely if seeded, but safe)
            email: 'pledgeum@gmail.com' // Fallback/Hack for demo if doc didn't exist
        };

        try {
            if (alumniId) {
                // Use setDoc with merge to create or update
                await setDoc(doc(db, 'alumni', alumniId), surveyData, { merge: true });
            } else {
                console.warn("No Alumni ID provided in URL. Saving to 'anonymous_surveys'.");
                // Optional: Save to a generic collection
            }
        } catch (error) {
            console.error("Error saving survey:", error);
            // alert("Erreur lors de la sauvegarde. Veuillez réessayer."); 
            // We might want to show UI error, but for now log it.
        }

        console.log("Survey Submitted:", surveyData);

        setLoading(false);
        setSubmitted(true);
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white max-w-lg w-full rounded-2xl shadow-xl p-8 text-center animate-in zoom-in duration-300">
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Merci pour votre réponse !</h1>
                    <p className="text-gray-600 mb-6">
                        Vos informations ont été mises à jour. Grâce à vous, nous maintenons un lien fort avec nos anciens élèves.
                    </p>
                    <button onClick={() => window.close()} className="text-blue-600 hover:text-blue-800 font-medium underline">
                        Fermer la page
                    </button>
                </div>
            </div>
        );
    }



    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex flex-col items-center justify-center p-4 font-sans">
            <div className="bg-white max-w-2xl w-full rounded-2xl shadow-2xl border border-white/50 overflow-hidden">
                {/* Header */}
                <div className="bg-blue-600 text-white p-8 text-center relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/30 shadow-inner">
                            <GraduationCap className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-3xl font-bold mb-2 tracking-tight">Que devenez-vous ?</h1>
                        <p className="text-blue-100 max-w-md mx-auto font-medium">
                            {alumniData ? (
                                <>
                                    Bonjour, <span className="font-bold text-white">{alumniData.prenom} {alumniData.nom}</span>, né(e) le {alumniData.date_naissance}.<br />
                                    Ancien élève au <span className="font-bold text-white">{alumniData.lycee}</span> de {alumniData.ville}.<br />
                                    Afin de garder le contact, nous vous remercions de répondre à ce petit questionnaire.
                                </>
                            ) : (
                                "Participez à la vie de votre ancien lycée en répondant à ce court sondage professionnel."
                            )}
                        </p>
                    </div>
                    {/* Background decoration */}
                    <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
                        <div className="absolute -top-20 -left-20 w-60 h-60 bg-white rounded-full blur-3xl mix-blend-overlay"></div>
                        <div className="absolute bottom-10 right-10 w-40 h-40 bg-indigo-300 rounded-full blur-3xl mix-blend-overlay"></div>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-8 space-y-8">

                    {/* Question 0: Studies */}
                    <div className="space-y-4">
                        <label className="text-xl font-bold text-gray-900 flex items-center">
                            <GraduationCap className="w-6 h-6 mr-3 text-blue-600" />
                            Poursuivez-vous vos études ?
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                type="button"
                                onClick={() => setIsContinuingStudies(true)}
                                className={`p-5 rounded-xl border-2 transition-all flex flex-col items-center justify-center space-y-2 group ${isContinuingStudies === true
                                    ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-md transform scale-[1.02]'
                                    : 'border-gray-100 hover:border-blue-200 hover:bg-gray-50'
                                    }`}
                            >
                                <span className="text-xl font-bold">Oui</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsContinuingStudies(false);
                                    setStudyProgram('');
                                }}
                                className={`p-5 rounded-xl border-2 transition-all flex flex-col items-center justify-center space-y-2 group ${isContinuingStudies === false
                                    ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-md transform scale-[1.02]'
                                    : 'border-gray-100 hover:border-blue-200 hover:bg-gray-50'
                                    }`}
                            >
                                <span className="text-xl font-bold">Non</span>
                            </button>
                        </div>
                    </div>

                    {/* Question 0b: Study Program */}
                    {isContinuingStudies === true && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-500">
                            <label className="text-lg font-semibold text-gray-900">
                                Quelle formation suivez-vous ?
                            </label>
                            <input
                                type="text"
                                value={studyProgram}
                                onChange={(e) => setStudyProgram(e.target.value)}
                                placeholder="Ex: BTS SIO, Licence Pro, École d'ingénieur..."
                                className="w-full px-5 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm bg-gray-50/50 focus:bg-white text-lg"
                                required
                            />
                        </div>
                    )}

                    {/* Question 1: Employment */}
                    <div className="space-y-4 pt-6 border-t border-gray-100">
                        <label className="text-xl font-bold text-gray-900 flex items-center">
                            <Briefcase className="w-6 h-6 mr-3 text-blue-600" />
                            Êtes-vous actuellement en emploi ?
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                type="button"
                                onClick={() => setIsEmployed(true)}
                                className={`p-5 rounded-xl border-2 transition-all flex flex-col items-center justify-center space-y-2 group ${isEmployed === true
                                    ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-md transform scale-[1.02]'
                                    : 'border-gray-100 hover:border-blue-200 hover:bg-gray-50'
                                    }`}
                            >
                                <span className="text-xl font-bold">Oui</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsEmployed(false);
                                    setCompanyName('');
                                    setCompanyAddress('');
                                    setSiret('');
                                    setJobTitle('');
                                    setIsOpenToInterns(null);
                                    setIsLookingForJob(null);
                                    setJobSearchField('');
                                    setInterestedInOffers(null);
                                }}
                                className={`p-5 rounded-xl border-2 transition-all flex flex-col items-center justify-center space-y-2 group ${isEmployed === false
                                    ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-md transform scale-[1.02]'
                                    : 'border-gray-100 hover:border-blue-200 hover:bg-gray-50'
                                    }`}
                            >
                                <span className="text-xl font-bold">Non</span>
                            </button>
                        </div>
                    </div>

                    {/* Question 2: Company (If Employed) */}
                    {isEmployed && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                            <div className="space-y-3">
                                <label className="text-lg font-semibold text-gray-900 flex items-center">
                                    <Building2 className="w-5 h-5 mr-2 text-blue-600" />
                                    Dans quelle entreprise travaillez-vous ?
                                </label>
                                <div className="relative group">
                                    <Search className={`absolute left-4 top-4 w-5 h-5 transition-colors ${searchingCompany ? 'text-blue-500 animate-pulse' : 'text-gray-400 group-focus-within:text-blue-500'}`} />
                                    <input
                                        type="text"
                                        value={companyName}
                                        onChange={(e) => handleCompanySearch(e.target.value)}
                                        placeholder="Rechercher par nom ou SIRET..."
                                        className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm bg-gray-50/50 focus:bg-white text-lg"
                                        required
                                    />
                                    {showResults && searchResults.length > 0 && (
                                        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-2xl max-h-60 overflow-y-auto ring-1 ring-black/5">
                                            {searchResults.map((result, index) => {
                                                const address = result.adresse || result.siege?.adresse || '';
                                                return (
                                                    <button
                                                        key={`${result.siret}-${index}`}
                                                        type="button"
                                                        onClick={() => selectCompany(result)}
                                                        className="w-full text-left px-5 py-3 hover:bg-blue-50 border-b border-gray-50 last:border-none transition-colors group"
                                                    >
                                                        <p className="font-bold text-gray-900 group-hover:text-blue-700">{result.nom_complet}</p>
                                                        <p className="text-xs text-gray-500 mt-1">{address}</p>
                                                        <div className="flex items-center mt-1">
                                                            <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">SIRET: {result.siret}</span>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {siret && (
                                <div className="bg-green-50 border border-green-200 p-5 rounded-xl flex flex-col gap-2 animate-in fade-in duration-300 shadow-sm">
                                    <div className="flex items-center text-green-800 font-bold">
                                        <CheckCircle className="w-5 h-5 mr-2" />
                                        Entreprise sélectionnée
                                    </div>
                                    <div className="pl-7 text-sm text-green-900">
                                        <p className="font-bold text-lg">{companyName}</p>
                                        <p className="text-green-800/80">{companyAddress}</p>
                                        <p className="font-mono text-xs text-green-700 mt-2 bg-green-100/50 inline-block px-2 py-1 rounded">SIRET: {siret}</p>
                                    </div>
                                </div>
                            )}

                            {/* Question 2b: Job Title (After SIRET Validated) */}
                            {siret && (
                                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-500 delay-100">
                                    <label className="text-lg font-semibold text-gray-900 flex items-center">
                                        <Briefcase className="w-5 h-5 mr-2 text-blue-600" />
                                        Quel(le) poste / fonction occupez-vous ?
                                    </label>
                                    <input
                                        type="text"
                                        value={jobTitle}
                                        onChange={(e) => setJobTitle(e.target.value)}
                                        placeholder="Ex: Technicien de maintenance, Développeur web..."
                                        className="w-full px-5 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm bg-gray-50/50 focus:bg-white text-lg"
                                        required
                                    />
                                </div>
                            )}

                            {/* Question 3: Internship (If Company Identified) */}
                            <div className="space-y-4 pt-6 border-t border-gray-100">
                                <label className="text-lg font-semibold text-gray-900 leading-tight">
                                    Acceptez-vous de recevoir des demandes de stage d'élèves de votre ancien établissement ?
                                </label>
                                <div className="flex space-x-4">
                                    <label className={`flex-1 flex items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${isOpenToInterns === true ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold shadow-md' : 'border-gray-100 hover:bg-gray-50 hover:border-gray-300'}`}>
                                        <input
                                            type="radio"
                                            name="internship"
                                            className="hidden"
                                            checked={isOpenToInterns === true}
                                            onChange={() => setIsOpenToInterns(true)}
                                        />
                                        Oui
                                    </label>
                                    <label className={`flex-1 flex items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${isOpenToInterns === false ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold shadow-md' : 'border-gray-100 hover:bg-gray-50 hover:border-gray-300'}`}>
                                        <input
                                            type="radio"
                                            name="internship"
                                            className="hidden"
                                            checked={isOpenToInterns === false}
                                            onChange={() => setIsOpenToInterns(false)}
                                        />
                                        Non
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Questions for Unemployed */}
                    {isEmployed === false && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
                            {/* Looking for job? */}
                            <div className="space-y-4">
                                <label className="text-lg font-semibold text-gray-900 flex items-center">
                                    <Search className="w-5 h-5 mr-2 text-blue-600" />
                                    Recherchez-vous un emploi ?
                                </label>
                                <div className="flex space-x-4">
                                    <label className={`flex-1 flex items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${isLookingForJob === true ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold shadow-md' : 'border-gray-100 hover:bg-gray-50 hover:border-gray-300'}`}>
                                        <input
                                            type="radio"
                                            name="lookingForJob"
                                            className="hidden"
                                            checked={isLookingForJob === true}
                                            onChange={() => setIsLookingForJob(true)}
                                        />
                                        Oui
                                    </label>
                                    <label className={`flex-1 flex items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${isLookingForJob === false ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold shadow-md' : 'border-gray-100 hover:bg-gray-50 hover:border-gray-300'}`}>
                                        <input
                                            type="radio"
                                            name="lookingForJob"
                                            className="hidden"
                                            checked={isLookingForJob === false}
                                            onChange={() => setIsLookingForJob(false)}
                                        />
                                        Non
                                    </label>
                                </div>
                            </div>

                            {/* Job Search Field */}
                            {isLookingForJob === true && (
                                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-500">
                                    <label className="text-lg font-semibold text-gray-900">
                                        Dans quel domaine ?
                                    </label>
                                    <input
                                        type="text"
                                        value={jobSearchField}
                                        onChange={(e) => setJobSearchField(e.target.value)}
                                        placeholder="Ex: Informatique, Commerce, Mécanique..."
                                        className="w-full px-5 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm bg-gray-50/50 focus:bg-white text-lg"
                                        required
                                    />
                                </div>
                            )}

                            {/* Interested in offers? */}
                            <div className="space-y-4 pt-6 border-t border-gray-100">
                                <label className="text-lg font-semibold text-gray-900 leading-tight">
                                    Seriez-vous intéressé à recevoir des offres d'emplois ?
                                </label>
                                <div className="flex space-x-4">
                                    <label className={`flex-1 flex items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${interestedInOffers === true ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold shadow-md' : 'border-gray-100 hover:bg-gray-50 hover:border-gray-300'}`}>
                                        <input
                                            type="radio"
                                            name="interestedInOffers"
                                            className="hidden"
                                            checked={interestedInOffers === true}
                                            onChange={() => setInterestedInOffers(true)}
                                        />
                                        Oui
                                    </label>
                                    <label className={`flex-1 flex items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${interestedInOffers === false ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold shadow-md' : 'border-gray-100 hover:bg-gray-50 hover:border-gray-300'}`}>
                                        <input
                                            type="radio"
                                            name="interestedInOffers"
                                            className="hidden"
                                            checked={interestedInOffers === false}
                                            onChange={() => setInterestedInOffers(false)}
                                        />
                                        Non
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={
                                loading ||
                                (isContinuingStudies === null) ||
                                (isContinuingStudies === true && !studyProgram) ||
                                (isEmployed === null) ||
                                (isEmployed === true && (!siret || !jobTitle || isOpenToInterns === null)) ||
                                (isEmployed === false && (isLookingForJob === null || interestedInOffers === null)) ||
                                (isEmployed === false && isLookingForJob === true && !jobSearchField)
                            }
                            className="w-full py-5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold text-xl rounded-full shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all flex items-center justify-center"
                        >
                            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                                <>
                                    Valider mes réponses <ArrowRight className="w-6 h-6 ml-2" />
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
