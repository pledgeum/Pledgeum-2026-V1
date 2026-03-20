'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { X, Search, Plus, Trash, Edit, Mail, AlertTriangle, ShieldCheck, Download, Users, Briefcase, Sparkles, FileUp, HelpCircle, Archive, Key, Building, GraduationCap, Lock, Shield, FileSpreadsheet, UserPlus, Trash2, Building2, Loader2, ChevronDown, ChevronUp, Check, Calendar, AlertCircle, MapPin, ClipboardList, Star, Info, Server } from 'lucide-react';
import { useSchoolStore, COLLABORATOR_LABELS, CollaboratorRole, Teacher, Student, ClassDefinition, PartnerCompany } from '@/store/school';
import { StructureImportReviewModal } from '../StructureImportReviewModal';
import { TeacherImportReviewModal } from '../TeacherImportReviewModal';
import { ClassCalendarManager } from '../ClassCalendarManager';
import { useUserStore } from '@/store/user';
import Papa from 'papaparse';
import { useConventionStore } from '@/store/convention';
import { toast } from 'sonner';
import { CONVENTION_TYPES } from '@/config/conventionTypes';

// --- Checkable Dropdown Component ---
interface CheckableDropdownProps {
    label: string;
    options: string[];
    selected: string[];
    onChange: (selected: string[]) => void;
}

function CheckableDropdown({ label, options, selected, onChange }: CheckableDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (option: string) => {
        if (selected.includes(option)) {
            onChange(selected.filter(s => s !== option));
        } else {
            onChange([...selected, option]);
        }
    };

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between w-full min-w-[200px] px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                <div className="flex items-center overflow-hidden">
                    <span className="font-medium mr-2">{label}:</span>
                    {selected.length === 0 ? (
                        <span className="text-gray-400">Tous</span>
                    ) : (
                        <span className="truncate max-w-[120px]">
                            {selected.length} sélectionné{selected.length > 1 ? 's' : ''}
                        </span>
                    )}
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-80 overflow-y-auto">
                    <div className="p-2 border-b border-gray-100 flex justify-between bg-gray-50 sticky top-0 z-10">
                        <button onClick={() => onChange(options)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Tout sélectionner</button>
                        <button onClick={() => onChange([])} className="text-xs text-gray-500 hover:text-gray-700 font-medium">Tout désélectionner</button>
                    </div>
                    {options.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-gray-500 italic">Aucune option</div>
                    ) : (
                        options.map((option) => (
                            <div key={option} className="flex items-center px-3 py-2 cursor-pointer hover:bg-gray-100" onClick={() => toggleOption(option)}>
                                <div className={`flex-shrink-0 w-4 h-4 border rounded mr-3 flex items-center justify-center ${selected.includes(option) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                                    {selected.includes(option) && <Check className="w-3 h-3 text-white" />}
                                </div>
                                <span className="text-sm text-gray-700 truncate">{option}</span>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

export function SchoolAdminPanelSection() {
    const [activeTab, setActiveTab] = useState<'classes' | 'partners' | 'identity' | 'pfmp' | 'config' | 'collaborators' | 'rgpd'>('rgpd');

    const {
        collaborators, classes, addCollaborator, removeCollaborator, addClass, removeClass, updateClass,
        importTeachers, addTeacherToClass, removeTeacherFromClass, importGlobalTeachers,
        importStudents, addStudentToClass, removeStudentFromClass, allowedConventionTypes,
        fetchClassStudents, fetchClassTeachers,
        toggleConventionType, schoolHeadEmail, delegatedAdminId, setDelegatedAdmin, schoolName,
        schoolAddress, schoolPhone, schoolHeadName, generateStudentCredentials, regenerateStudentCredentials, markCredentialsPrinted, generateTeacherCredentials, markTeacherCredentialsPrinted, importGlobalStructure,
        partnerCompanies, importPartners, removePartner,
        // Visibility Store
        hiddenActivities, setHiddenActivities, hiddenJobs, setHiddenJobs, hiddenClasses, setHiddenClasses,
        restoreTestData,
        importProgress,
        updateSchoolIdentity,
        fetchSchoolData,
        fetchCollaborators
    } = useSchoolStore();

    const { conventions } = useConventionStore();
    const { email, role, id, schoolId, profileData } = useUserStore();

    // Fetch initial data
    useEffect(() => {
        if (schoolId) {
            fetchSchoolData(schoolId);
            fetchCollaborators(schoolId);
        }
    }, [schoolId, fetchSchoolData, fetchCollaborators]);

    // NEW PARTNERS FETCH
    const [fetchedPartners, setFetchedPartners] = useState<PartnerCompany[]>([]);
    const [isFetchingPartners, setIsFetchingPartners] = useState(false);

    useEffect(() => {
        if (schoolId && activeTab === 'partners') {
            setIsFetchingPartners(true);
            fetch(`/api/partners/search?uai=${schoolId}`)
                .then(res => res.json())
                .then(data => {
                    if (data.partners) setFetchedPartners(data.partners);
                })
                .catch(err => console.error("Error fetching partners:", err))
                .finally(() => setIsFetchingPartners(false));
        }
    }, [schoolId, activeTab]);

    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null);
    const globalFileInputRef = useRef<HTMLInputElement>(null);
    const teacherFileInputRef = useRef<HTMLInputElement>(null);
    const partnerFileInputRef = useRef<HTMLInputElement>(null);

    // Form States
    const [newCollab, setNewCollab] = useState({ name: '', email: '', role: 'ddfpt' as CollaboratorRole });
    const [expandedClassId, setExpandedClassId] = useState<string | null>(null);
    const [expandedStudentClassId, setExpandedStudentClassId] = useState<string | null>(null);
    const [newClass, setNewClass] = useState({
        name: '',
        mef: '',
        label: '',
        diploma: '',
        mainTeacher: { firstName: '', lastName: '', email: '' },
        cpe: { firstName: '', lastName: '', email: '' }
    });

    // Import Review States
    const [importReviewData, setImportReviewData] = useState<{ className: string; students: Omit<Student, 'id'>[] }[] | null>(null);
    const [teacherImportReviewData, setTeacherImportReviewData] = useState<{ teacher: Omit<Teacher, 'id'>; classes: string[] }[] | null>(null);
    const [isPartnerImporting, setIsPartnerImporting] = useState(false);

    // --- CONVENTION SETTINGS STATE ---
    const [conventionSettings, setConventionSettings] = useState<{ convention_type_id: string, class_ids: string[] }[]>([]);
    const [isFetchingSettings, setIsFetchingSettings] = useState(false);
    const [isSavingSettings, setIsSavingSettings] = useState(false);

    // Fetch Convention Settings
    useEffect(() => {
        if (schoolId && activeTab === 'config') {
            setIsFetchingSettings(true);
            fetch(`/api/school/conventions/settings?uai=${schoolId}`)
                .then(res => res.json())
                .then(data => {
                    if (data.settings) {
                        setConventionSettings(data.settings);
                    }
                })
                .catch(err => console.error("Error fetching convention settings:", err))
                .finally(() => setIsFetchingSettings(false));
        }
    }, [schoolId, activeTab]);

    const handleToggleConvention = (typeId: string, enabled: boolean) => {
        if (enabled) {
            setConventionSettings(prev => [...prev, { convention_type_id: typeId, class_ids: [] }]);
        } else {
            setConventionSettings(prev => prev.filter(s => s.convention_type_id !== typeId));
        }
    };

    const handleToggleClassForConvention = (typeId: string, classId: string) => {
        setConventionSettings(prev => prev.map(s => {
            if (s.convention_type_id !== typeId) return s;
            const hasClass = s.class_ids.includes(classId);
            return {
                ...s,
                class_ids: hasClass 
                    ? s.class_ids.filter(id => id !== classId) 
                    : [...s.class_ids, classId]
            };
        }));
    };

    const handleSaveConventions = async () => {
        if (!schoolId) return;
        setIsSavingSettings(true);
        const toastId = toast.loading("Sauvegarde des configurations...");
        
        try {
            const promises = Object.values(CONVENTION_TYPES).map(type => {
                const setting = conventionSettings.find(s => s.convention_type_id === type.id);
                if (setting) {
                    return fetch('/api/school/conventions/settings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            uai: schoolId,
                            convention_type_id: type.id,
                            class_ids: setting.class_ids
                        })
                    });
                }
                return null;
            }).filter(p => p !== null);

            await Promise.all(promises);
            toast.success("Configurations enregistrées !", { id: toastId });
        } catch (error: any) {
            console.error("Save conventions error:", error);
            toast.error("Erreur lors de la sauvegarde.", { id: toastId });
        } finally {
            setIsSavingSettings(false);
        }
    };

    // Permissions
    const isSchoolHead = (email && schoolHeadEmail && email.toLowerCase() === schoolHeadEmail.toLowerCase()) || role === 'school_head';
    const isDDFPT = role === 'ddfpt';
    const isDelegatedAdmin = email && collaborators.some(c => c.id === delegatedAdminId && (c.email || '').toLowerCase() === email.toLowerCase());
    const canEditIdentity = isSchoolHead || isDDFPT || isDelegatedAdmin || (schoolHeadEmail === "");

    // Validation
    const missingIdentity = !schoolName || !schoolAddress || !schoolPhone || !schoolHeadName || !schoolHeadEmail;
    const missingClasses = classes.length === 0 || !classes.some(c => c.mainTeacher && c.mainTeacher.lastName);
    const missingConfig = !allowedConventionTypes || allowedConventionTypes.length === 0;

    // Derived Partner Data
    const uniqueActivities = useMemo(() => Array.from(new Set(fetchedPartners.map(p => p.activity).filter(Boolean))).sort(), [fetchedPartners]);
    const uniqueJobs = useMemo(() => Array.from(new Set(fetchedPartners.flatMap(p => p.jobs || []).filter(Boolean))).sort(), [fetchedPartners]);
    const classesBySiret = useMemo(() => {
        const map = new Map<string, Set<string>>();
        conventions.forEach(c => {
            if (c.ent_siret && c.eleve_classe) {
                if (!map.has(c.ent_siret)) map.set(c.ent_siret, new Set());
                map.get(c.ent_siret)?.add(c.eleve_classe);
            }
        });
        return map;
    }, [conventions]);

    const visibleActivities = uniqueActivities.filter(a => !(hiddenActivities || []).includes(a));
    const visibleJobs = uniqueJobs.filter(j => !(hiddenJobs || []).includes(j));

    const filteredPartners = useMemo(() => {
        const safeHiddenActivities = hiddenActivities || [];
        const safeHiddenJobs = hiddenJobs || [];

        return fetchedPartners.filter(p => {
            if (p.activity && safeHiddenActivities.includes(p.activity)) return false;
            if (p.jobs && p.jobs.length > 0 && !p.jobs.some(j => !safeHiddenJobs.includes(j))) return false;
            return true;
        });
    }, [fetchedPartners, hiddenActivities, hiddenJobs]);

    // Handlers
    const handleActivityChange = (selected: string[]) => {
        const hidden = uniqueActivities.filter(a => !selected.includes(a));
        setHiddenActivities(hidden);
    };

    const handleJobChange = (selected: string[]) => {
        const hidden = uniqueJobs.filter(j => !selected.includes(j));
        setHiddenJobs(hidden);
    };
    const handleAddCollaborator = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newCollab.name && newCollab.email && schoolId) {
            try {
                const toastId = toast.loading("Création du collaborateur...");
                const response = await fetch('/api/school/collaborators', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: newCollab.name,
                        email: newCollab.email,
                        role: newCollab.role,
                        uai: schoolId
                    })
                });

                if (!response.ok) {
                    if (response.status === 409) {
                        toast.dismiss(toastId);
                        alert("Ce collaborateur est déjà enregistré pour cet établissement.");
                        return;
                    }
                    const errData = await response.json();
                    throw new Error(errData.error || "Erreur inconnue");
                }

                toast.success(`Invitation envoyée à ${newCollab.email}`, { id: toastId });
                if (fetchCollaborators) await fetchCollaborators(schoolId);
                setNewCollab({ name: '', email: '', role: 'ddfpt' });
            } catch (err: any) {
                console.error("Add Collaborator Error:", err);
                toast.error(`Erreur: ${err.message}`);
            }
        }
    };

    const handleGlobalImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        Papa.parse(file, {
            header: true, skipEmptyLines: true,
            complete: (results) => {
                const map = new Map<string, Omit<Student, 'id'>[]>();
                const normalizeKey = (key: string) => key.trim().toUpperCase().replace(/[^A-Z]/g, '');
                results.data.forEach((row: any) => {
                    const normalizedRow: any = {};
                    Object.keys(row).forEach(k => normalizedRow[normalizeKey(k)] = row[k]);
                    const nom = normalizedRow['NOM'];
                    const prenom = normalizedRow['PRENOM'];
                    const dateNaiss = normalizedRow['DATENAISS'] || normalizedRow['NEELE'] || normalizedRow['DATENAISSANCE'];
                    const classeRaw = normalizedRow['CLASSES'] || normalizedRow['CLASSE'] || normalizedRow['DIVISION'];
                    if (nom && prenom && classeRaw) {
                        const className = classeRaw.split(',')[0].trim();
                        const student = { firstName: prenom, lastName: nom, email: "", birthDate: dateNaiss, originalClass: className };
                        if (!map.has(className)) map.set(className, []);
                        map.get(className)?.push(student);
                    }
                });
                const structure = Array.from(map.entries()).map(([className, students]) => ({ className, students }));
                if (structure.length > 0) setImportReviewData(structure);
                else alert("Aucune donnée valide trouvée.");
                if (globalFileInputRef.current) globalFileInputRef.current.value = '';
            }
        });
    };

    const handleTeacherImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        Papa.parse(file, {
            header: true, skipEmptyLines: true, delimiter: ";", encoding: "ISO-8859-1",
            complete: (results) => {
                const teachers: { teacher: Omit<Teacher, 'id'>; classes: string[] }[] = [];
                results.data.forEach((row: any) => {
                    const nom = row['NOM'] || row['Nom'];
                    const prenom = row['PRENOM'] || row['Prénom'];
                    const classesRaw = row['CLASSES'] || row['Classes'];
                    if (nom && prenom) {
                        const classList = classesRaw ? classesRaw.split(',').map((c: string) => c.trim()).filter((c: string) => c.length > 0) : [];
                        if (classList.length > 0) teachers.push({ teacher: { firstName: prenom, lastName: nom, email: "", birthDate: row['DATE NAISS'] }, classes: classList });
                    }
                });
                if (teachers.length > 0) setTeacherImportReviewData(teachers);
                else alert("Aucun enseignant valide trouvé.");
                if (teacherFileInputRef.current) teacherFileInputRef.current.value = "";
            }
        });
    };

    const handlePartnerImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        setIsPartnerImporting(true);
        Papa.parse(file, {
            header: true, skipEmptyLines: true,
            complete: async (results) => {
                const totalRows = results.data.length;
                let processedRows = 0;
                useSchoolStore.getState().setImportProgress({ current: 0, total: totalRows, status: "Analyse des entreprises..." });

                const findKey = (row: any, search: string[]) => {
                    const keys = Object.keys(row);
                    for (const k of keys) {
                        const nk = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                        for (const s of search) if (nk.includes(s.toLowerCase())) return row[k];
                    }
                    return '';
                };
                const partnersToAdd: PartnerCompany[] = [];
                for (const row of results.data as any[]) {
                    processedRows++;
                    useSchoolStore.getState().setImportProgress({ current: processedRows, total: totalRows, status: "Recherche SIRENE..." });
                    const act = findKey(row, ['activite', 'activity']) || '';
                    const met = findKey(row, ['metier', 'job']) || '';
                    const sir = (findKey(row, ['siret', 'lieusiret']) || '').replace(/[^0-9]/g, '');
                    if (sir.length !== 14) continue;
                    const jobs = met ? met.split(/[;,]/).map((j: string) => j.trim()).filter((j: string) => j.length > 0) : [];
                    try {
                        const resp = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${sir}&limit=1`);
                        if (resp.ok) {
                            const data = await resp.json();
                            if (data.results && data.results.length > 0) {
                                const c = data.results[0];
                                partnersToAdd.push({
                                    siret: sir, name: c.nom_complet || `Entreprise ${sir}`,
                                    address: c.siege.adresse || '', city: c.siege.libelle_commune || '', postalCode: c.siege.code_postal || '',
                                    coordinates: c.siege.latitude ? { lat: parseFloat(c.siege.latitude), lng: parseFloat(c.siege.longitude) } : undefined,
                                    activity: act, jobs: jobs
                                });
                            }
                        }
                    } catch (err) { }
                    await new Promise(r => setTimeout(r, 50));
                }
                if (partnersToAdd.length > 0) {
                    if (!schoolId) return;
                    try {
                        useSchoolStore.getState().setImportProgress({ current: processedRows, total: totalRows, status: "Sauvegarde en BDD..." });
                        const response = await fetch('/api/partners/import', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ partners: partnersToAdd, schoolId })
                        });
                        const result = await response.json();
                        alert(`Import Partenaires Réussi !\n\nCréés: ${result.stats.created}\nMis à jour: ${result.stats.updated}`);
                        fetch(`/api/partners/search?uai=${schoolId}`).then(res => res.json()).then(data => { if (data.partners) setFetchedPartners(data.partners); });
                    } catch (err: any) { alert(`Erreur d'import : ${err.message}`); }
                }
                setIsPartnerImporting(false);
                useSchoolStore.getState().setImportProgress(null);
            }
        });
    };

    const handleGenerateCredentials = async (classId: string) => {
        const toastId = toast.loading("Génération des identifiants...");
        try {
            generateStudentCredentials(classId);
            await new Promise(resolve => setTimeout(resolve, 100));
            const cls = useSchoolStore.getState().classes.find(c => c.id === classId);
            if (!cls || !cls.studentsList || cls.studentsList.length === 0) {
                toast.dismiss(toastId);
                alert("Aucun élève dans cette classe.");
                return;
            }
            const invitationsPayload = cls.studentsList.map(s => ({ userId: s.id, tempId: s.tempId, tempCode: s.tempCode }));
            if (!schoolId) return;
            const response = await fetch('/api/school/invitations/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uai: schoolId, invitations: invitationsPayload })
            });

            if (!response.ok) throw new Error("Échec de la sauvegarde");
            const { generateStudentCredentialsBlob } = await import('@/components/pdf/CredentialPdfGenerator');
            const blob = await generateStudentCredentialsBlob(cls.studentsList, cls, schoolName);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Identifiants_${cls.name}.pdf`;
            a.click();
            markCredentialsPrinted(classId, cls.studentsList.map(s => s.id));
            toast.success("Identifiants générés !", { id: toastId });
        } catch (error: any) { toast.error(`Erreur: ${error.message}`, { id: toastId }); }
    };

    const handleGenerateTeacherCredentials = async (classId: string) => {
        const toastId = toast.loading("Génération des identifiants enseignants...");
        try {
            generateTeacherCredentials(classId, schoolId || '');
            await new Promise(resolve => setTimeout(resolve, 100));
            const cls = useSchoolStore.getState().classes.find(c => c.id === classId);
            if (!cls || !cls.teachersList || cls.teachersList.length === 0) {
                toast.dismiss(toastId);
                alert("Aucun enseignant dans cette classe.");
                return;
            }
            const invitationsPayload = cls.teachersList.map(t => ({ userId: t.id, tempId: t.tempId, tempCode: t.tempCode }));
            if (!schoolId) return;
            const response = await fetch('/api/school/invitations/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uai: schoolId, invitations: invitationsPayload })
            });

            if (!response.ok) throw new Error("Échec de la sauvegarde");
            const { generateTeacherCredentialsBlob } = await import('@/components/pdf/CredentialPdfGenerator');
            const blob = await generateTeacherCredentialsBlob(cls.teachersList, cls, schoolName);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Identifiants_Profs_${cls.name}.pdf`;
            a.click();
            markTeacherCredentialsPrinted(classId, cls.teachersList.map(t => t.id));
            toast.success("Identifiants enseignants générés !", { id: toastId });
        } catch (error: any) { toast.error(`Erreur: ${error.message}`, { id: toastId }); }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 border-b border-gray-200">
                    <nav className="flex overflow-x-auto scrollbar-hide">
                        {[
                            { id: 'rgpd', label: 'RGPD', icon: ShieldCheck },
                            { id: 'identity', label: 'Identité', icon: Building, warning: missingIdentity },
                            { id: 'collaborators', label: 'Collaborateurs', icon: Users },
                            { id: 'classes', label: 'Classes & Imports', icon: GraduationCap, warning: missingClasses },
                            { id: 'config', label: 'Sélection des conventions types', icon: Sparkles, warning: missingConfig },
                            { id: 'pfmp', label: 'Calendrier PFMP', icon: Calendar },
                            { id: 'partners', label: 'Partenaires', icon: Building2 },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap relative ${activeTab === tab.id
                                    ? 'border-blue-600 text-blue-600 bg-white'
                                    : 'border-transparent text-gray-500 hover:text-blue-600 hover:bg-gray-100'
                                    }`}
                            >
                                <tab.icon className="w-4 h-4 mr-2" />
                                {tab.label}
                                {tab.warning && <span className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="p-6">
                    {activeTab === 'classes' && (
                        <div className="space-y-8">
                            <div className="bg-blue-50 p-6 rounded-lg border border-blue-100">
                                <h4 className="text-sm font-bold text-blue-900 mb-4 flex items-center">
                                    <Sparkles className="w-4 h-4 mr-2" /> Imports Globaux
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-white p-4 rounded-lg border border-blue-200 flex items-center justify-between shadow-sm">
                                        <div className="flex items-center">
                                            <FileSpreadsheet className="w-5 h-5 mr-3 text-green-600" />
                                            <div>
                                                <h5 className="font-bold text-gray-900 text-sm">Structure</h5>
                                                <p className="text-xs text-gray-500">Classes et Élèves (CSV Pronote)</p>
                                            </div>
                                        </div>
                                        <button onClick={() => globalFileInputRef.current?.click()} className="px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 flex items-center">
                                            <FileUp className="w-4 h-4 mr-2" /> Importer
                                        </button>
                                        <input type="file" ref={globalFileInputRef} onChange={handleGlobalImportCSV} accept=".csv" className="hidden" />
                                    </div>
                                    <div className="bg-white p-4 rounded-lg border border-blue-200 flex items-center justify-between shadow-sm">
                                        <div className="flex items-center">
                                            <Users className="w-5 h-5 mr-3 text-indigo-600" />
                                            <div>
                                                <h5 className="font-bold text-gray-900 text-sm">Enseignants</h5>
                                                <p className="text-xs text-gray-500">Profs et Affectations (CSV)</p>
                                            </div>
                                        </div>
                                        <button onClick={() => teacherFileInputRef.current?.click()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 flex items-center">
                                            <FileUp className="w-4 h-4 mr-2" /> Importer
                                        </button>
                                        <input type="file" ref={teacherFileInputRef} onChange={handleTeacherImportCSV} accept=".csv" className="hidden" />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                                <h4 className="text-lg font-bold text-gray-900 mb-6">Gestion des Classes</h4>
                                <div className="space-y-4">
                                    {classes.map(cls => (
                                        <div key={cls.id} className="border border-gray-200 rounded-xl overflow-hidden">
                                            <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-b border-gray-200">
                                                <div>
                                                    <h5 className="font-bold text-gray-900">{cls.name}</h5>
                                                    <p className="text-xs text-gray-500 flex items-center flex-wrap gap-2 mt-0.5">
                                                        <span>{cls.label || 'Formation non définie'} • {cls.studentCount || 0} élèves</span>
                                                        {cls.mainTeacher && <span className="flex items-center text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100"><Star className="w-3 h-3 mr-1 fill-amber-500 text-amber-500" />PP: {cls.mainTeacher.firstName.charAt(0)}. {cls.mainTeacher.lastName}</span>}
                                                    </p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => { setExpandedStudentClassId(expandedStudentClassId === cls.id ? null : cls.id); if (expandedStudentClassId !== cls.id) fetchClassStudents(cls.id); }} className="px-3 py-1.5 text-xs font-medium text-orange-700 bg-orange-50 rounded-lg border border-orange-100 hover:bg-orange-100">Élèves</button>
                                                    <button onClick={() => { setExpandedClassId(expandedClassId === cls.id ? null : cls.id); if (expandedClassId !== cls.id) fetchClassTeachers(cls.id); }} className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg border border-blue-100 hover:bg-blue-100">Équipe</button>
                                                    <button onClick={() => removeClass(cls.id)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            </div>
                                            {expandedStudentClassId === cls.id && (
                                                <div className="p-4 bg-white border-t border-gray-100">
                                                    <button onClick={() => handleGenerateCredentials(cls.id)} className="text-xs text-purple-600 hover:underline mb-4 block">Générer les identifiants</button>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                                        {cls.studentsList?.map(s => <div key={s.id} className="p-2 bg-gray-50 rounded border border-gray-100 text-xs flex justify-between">{s.firstName} {s.lastName} <button onClick={() => removeStudentFromClass(cls.id, s.id)} className="text-red-400 hover:text-red-600">×</button></div>)}
                                                    </div>
                                                </div>
                                            )}
                                            {expandedClassId === cls.id && (
                                                <div className="p-4 bg-white border-t border-blue-100">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                                        {cls.teachersList?.map(t => <div key={t.id} className="p-2 bg-blue-50 rounded border border-blue-100 text-xs flex justify-between">{t.firstName} {t.lastName} <button onClick={() => removeTeacherFromClass(cls.id, t.id)} className="text-red-400 hover:text-red-600">×</button></div>)}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'partners' && (
                        <div className="space-y-6">
                            <div className="bg-white p-6 rounded-lg border border-gray-200 flex items-center justify-between shadow-sm">
                                <div>
                                    <h4 className="font-bold text-gray-900">Base de données Partenaires</h4>
                                    <p className="text-sm text-gray-500">Importez vos entreprises partenaires.</p>
                                </div>
                                <button onClick={() => partnerFileInputRef.current?.click()} disabled={isPartnerImporting} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center">
                                    {isPartnerImporting ? <Loader2 className="animate-spin w-5 h-5 mr-2" /> : <FileSpreadsheet className="w-5 h-5 mr-2" />}
                                    Importer Partenaires (CSV)
                                </button>
                                <input type="file" ref={partnerFileInputRef} onChange={handlePartnerImportCSV} accept=".csv" className="hidden" />
                            </div>

                            <div className="flex flex-wrap gap-4 items-center bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <CheckableDropdown label="Activités" options={uniqueActivities} selected={visibleActivities} onChange={handleActivityChange} />
                                <CheckableDropdown label="Filières" options={uniqueJobs} selected={visibleJobs} onChange={handleJobChange} />
                            </div>

                            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">SIRET</th>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Nom</th>
                                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Ville</th>
                                            <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {filteredPartners.map(p => (
                                            <tr key={p.siret}>
                                                <td className="px-6 py-4 text-sm text-gray-500">{p.siret}</td>
                                                <td className="px-6 py-4 text-sm font-bold text-gray-900">{p.name}</td>
                                                <td className="px-6 py-4 text-sm text-gray-500">{p.city}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <button onClick={() => removePartner(p.siret)} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'identity' && (
                        <div className="max-w-2xl space-y-6">
                            <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
                                <h4 className="text-lg font-bold text-gray-900 mb-6 flex items-center"><Building className="w-6 h-6 mr-3 text-orange-600" /> Identité</h4>
                                <div className="space-y-4">
                                    <input type="text" value={schoolName || ''} onChange={(e) => updateSchoolIdentity({ schoolName: e.target.value })} className="w-full border-gray-300 rounded-lg text-sm" disabled={!canEditIdentity} placeholder="Nom de l'établissement" />
                                    <textarea rows={3} value={schoolAddress || ''} onChange={(e) => updateSchoolIdentity({ schoolAddress: e.target.value })} className="w-full border-gray-300 rounded-lg text-sm" disabled={!canEditIdentity} placeholder="Adresse" />
                                    <input type="text" value={schoolPhone || ''} onChange={(e) => updateSchoolIdentity({ schoolPhone: e.target.value })} className="w-full border-gray-300 rounded-lg text-sm" disabled={!canEditIdentity} placeholder="Téléphone" />
                                    <input type="text" value={schoolHeadName || ''} onChange={(e) => updateSchoolIdentity({ schoolHeadName: e.target.value })} className="w-full border-gray-300 rounded-lg text-sm" disabled={!canEditIdentity} placeholder="Nom du Chef d'établissement" />
                                    <input type="email" value={schoolHeadEmail || ''} onChange={(e) => updateSchoolIdentity({ schoolHeadEmail: e.target.value })} className="w-full border-gray-300 rounded-lg text-sm" disabled={!canEditIdentity} placeholder="Email académique" />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'pfmp' && <ClassCalendarManager />}

                    {activeTab === 'config' && (
                        <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm max-w-2xl">
                            <h4 className="text-lg font-bold text-gray-900 mb-6 flex items-center"><Sparkles className="w-5 h-5 mr-3 text-purple-600" /> Types de Convention</h4>
                            <div className="space-y-4">
                                {Object.values(CONVENTION_TYPES).map(type => {
                                    const setting = conventionSettings.find(s => s.convention_type_id === type.id);
                                    const isEnabled = !!setting;
                                    return (
                                        <div key={type.id} className="p-4 border rounded-xl">
                                            <div className="flex items-center">
                                                <input type="checkbox" checked={isEnabled} onChange={(e) => handleToggleConvention(type.id, e.target.checked)} className="w-5 h-5 rounded border-gray-300" />
                                                <label className="ml-4 font-bold text-sm">{type.label}</label>
                                            </div>
                                            {isEnabled && (
                                                <div className="mt-4 flex flex-wrap gap-2">
                                                    {classes.map(cls => (
                                                        <button key={cls.id} onClick={() => handleToggleClassForConvention(type.id, cls.id)} className={`px-3 py-1.5 rounded-full text-xs font-bold border ${setting.class_ids.includes(cls.id) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200 text-gray-600'}`}>
                                                            {cls.name}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            <button onClick={handleSaveConventions} disabled={isSavingSettings} className="mt-8 px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold text-sm w-full">
                                {isSavingSettings ? 'Enregistrement...' : 'Enregistrer'}
                            </button>
                        </div>
                    )}

                    {activeTab === 'collaborators' && (
                        <div className="space-y-8 max-w-4xl">
                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center"><UserPlus className="w-4 h-4 mr-2 text-blue-600" /> Ajouter un collaborateur</h4>
                                <form onSubmit={handleAddCollaborator} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                    <select value={newCollab.role} onChange={e => setNewCollab({ ...newCollab, role: e.target.value as CollaboratorRole })} className="w-full text-sm border-gray-300 rounded-lg">
                                        {Object.entries(COLLABORATOR_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                    </select>
                                    <input type="text" value={newCollab.name} onChange={e => setNewCollab({ ...newCollab, name: e.target.value })} placeholder="Nom" className="text-sm border-gray-300 rounded-lg" required />
                                    <input type="email" value={newCollab.email} onChange={e => setNewCollab({ ...newCollab, email: e.target.value })} placeholder="Email" className="text-sm border-gray-300 rounded-lg" required />
                                    <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold h-[38px]">Ajouter</button>
                                </form>
                            </div>
                            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                                {collaborators.map(c => (
                                    <div key={c.id} className="p-4 flex items-center justify-between border-b">
                                        <div className="flex items-center">
                                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-4 text-blue-700 font-bold">{c.name.charAt(0)}</div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900">{c.name}</p>
                                                <p className="text-xs text-gray-500">{c.email}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-[10px] font-bold">{COLLABORATOR_LABELS[c.role]}</span>
                                            <button onClick={() => removeCollaborator(c.id)} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'rgpd' && (
                        <div className="max-w-4xl mx-auto space-y-8">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start">
                                <Info className="w-6 h-6 text-blue-600 mr-3 mt-0.5" />
                                <div>
                                    <h5 className="text-sm font-bold text-blue-900">Mise à jour du Registre des Traitements</h5>
                                    <p className="text-sm text-blue-800 leading-relaxed">Conformité au RGPD pour la gestion des PFMP.</p>
                                </div>
                            </div>
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                                <h4 className="font-bold mb-4">Hébergement Souverain (Scaleway France)</h4>
                                <p className="text-sm text-gray-600">Données régies par le droit français. Certifié ISO 27001.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {importReviewData && (
                <StructureImportReviewModal
                    isOpen={true}
                    onClose={() => setImportReviewData(null)}
                    data={importReviewData}
                    onConfirm={(d) => { if (schoolId) importGlobalStructure(d, schoolId); setImportReviewData(null); }}
                />
            )}
            {teacherImportReviewData && (
                <TeacherImportReviewModal
                    isOpen={true}
                    onClose={() => setTeacherImportReviewData(null)}
                    data={teacherImportReviewData}
                    onConfirm={(d) => { if (schoolId) importGlobalTeachers(d, schoolId); setTeacherImportReviewData(null); }}
                />
            )}
        </div>
    );
}
