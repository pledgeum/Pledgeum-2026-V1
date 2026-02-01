'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { X, Search, Plus, Trash, Edit, Mail, AlertTriangle, ShieldCheck, Download, Users, Briefcase, Sparkles, FileUp, HelpCircle, Archive, Key, Building, GraduationCap, Lock, Shield, FileSpreadsheet, UserPlus, Trash2, Building2, Loader2, ChevronDown, Check, Calendar, AlertCircle, MapPin, ClipboardList, Star, Info, Server } from 'lucide-react';
import { useSchoolStore, COLLABORATOR_LABELS, CollaboratorRole, Teacher, Student, ClassDefinition, PartnerCompany } from '@/store/school';
import { StructureImportReviewModal } from './StructureImportReviewModal';
import { TeacherImportReviewModal } from './TeacherImportReviewModal';
import { ClassCalendarManager } from './ClassCalendarManager';
import { useUserStore } from '@/store/user';
import Papa from 'papaparse';
import { useConventionStore } from '@/store/convention';
import { db, collection, query, where, getDocs, deleteDoc, doc, writeBatch } from '@/lib/firebase';
import { pdf } from '@react-pdf/renderer';
import { StudentCredentialsPdf } from '@/components/pdf/StudentCredentialsPdf';
import { TeacherCredentialsPdf } from '@/components/pdf/TeacherCredentialsPdf';
import { toast } from 'sonner';

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

export default function SchoolAdminDashboard() {
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

    console.log('[DASHBOARD_DEBUG] State:', {
        email,
        role,
        uid: id,
        schoolId,
        profileDataUai: profileData?.uai,
        storeUai: schoolId
    });

    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null);
    const studentFileInputRef = useRef<HTMLInputElement>(null);
    const globalFileInputRef = useRef<HTMLInputElement>(null);
    const teacherFileInputRef = useRef<HTMLInputElement>(null);
    const partnerFileInputRef = useRef<HTMLInputElement>(null);

    // Form States
    const [newCollab, setNewCollab] = useState({ name: '', email: '', role: 'ddfpt' as CollaboratorRole });
    const [newTeacher, setNewTeacher] = useState({ firstName: '', lastName: '', email: '' });
    const [newStudent, setNewStudent] = useState({ firstName: '', lastName: '', email: '', birthDate: '' });
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
    const [importHelpType, setImportHelpType] = useState<'structure' | 'teacher' | null>(null);
    const [isPartnerImporting, setIsPartnerImporting] = useState(false);
    const [isManualMode, setIsManualMode] = useState(false);

    // Permissions
    const isSchoolHead = (email && schoolHeadEmail && email.toLowerCase() === schoolHeadEmail.toLowerCase()) || role === 'school_head';
    const isDDFPT = role === 'ddfpt';
    const isDelegatedAdmin = email && collaborators.some(c => c.id === delegatedAdminId && c.email.toLowerCase() === email.toLowerCase());
    const canEditIdentity = isSchoolHead || isDDFPT || isDelegatedAdmin || (schoolHeadEmail === "");
    const canDelegate = isSchoolHead || isDDFPT || (schoolHeadEmail === "");

    // Validation
    const missingIdentity = !schoolName || !schoolAddress || !schoolPhone || !schoolHeadName || !schoolHeadEmail;
    const missingClasses = classes.length === 0 || !classes.some(c => c.mainTeacher && c.mainTeacher.lastName);
    const missingConfig = !allowedConventionTypes || allowedConventionTypes.length === 0;

    // Derived Partner Data
    const uniqueActivities = useMemo(() => Array.from(new Set(partnerCompanies.map(p => p.activity).filter(Boolean))).sort(), [partnerCompanies]);
    const uniqueJobs = useMemo(() => Array.from(new Set(partnerCompanies.flatMap(p => p.jobs || []).filter(Boolean))).sort(), [partnerCompanies]);
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

    const uniqueClassesForPartners = useMemo(() => {
        const set = new Set<string>();
        classesBySiret.forEach(classes => classes.forEach(c => set.add(c)));
        return Array.from(set).sort();
    }, [classesBySiret]);

    const visibleActivities = uniqueActivities.filter(a => !hiddenActivities.includes(a));
    const visibleJobs = uniqueJobs.filter(j => !hiddenJobs.includes(j));
    const visibleClasses = uniqueClassesForPartners.filter(c => !hiddenClasses.includes(c));

    const filteredPartners = useMemo(() => {
        return partnerCompanies.filter(p => {
            if (p.activity && hiddenActivities.includes(p.activity)) return false;
            if (p.jobs && p.jobs.length > 0 && !p.jobs.some(j => !hiddenJobs.includes(j))) return false;
            const partnerClasses = classesBySiret.get(p.siret);
            if (partnerClasses && partnerClasses.size > 0 && !Array.from(partnerClasses).some(c => !hiddenClasses.includes(c))) return false;
            return true;
        });
    }, [partnerCompanies, hiddenActivities, hiddenJobs, hiddenClasses, classesBySiret]);

    // Handlers
    const handleAddCollaborator = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newCollab.name && newCollab.email && schoolId) {
            try {
                const toastId = toast.loading("Création du collaborateur...");
                console.log("👉 Sending Add Collaborator Request. UAI:", schoolId);

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
                        // Don't throw generic error, just stop
                        return;
                    }
                    const errData = await response.json();
                    throw new Error(errData.error || "Erreur inconnue");
                }

                toast.success(`Invitation envoyée à ${newCollab.email}`, { id: toastId });

                // Refresh data to show new collaborator
                if (fetchCollaborators) {
                    await fetchCollaborators(schoolId);
                }

                setNewCollab({ name: '', email: '', role: 'ddfpt' });

            } catch (err: any) {
                console.error("Add Collaborator Error:", err);
                toast.error(`Erreur: ${err.message}`);
            }
        } else {
            alert("Veuillez remplir tous les champs et vérifier l'identifiant de l'établissement.");
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

    const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>, classId: string) => {
        const file = e.target.files?.[0];
        if (!file) return;
        Papa.parse(file, {
            header: true, skipEmptyLines: true,
            complete: (results) => {
                const teachers: Omit<Teacher, 'id'>[] = [];
                results.data.forEach((row: any) => {
                    const ln = row['Nom'] || row['nom'];
                    const fn = row['Prénom'] || row['prenom'];
                    const em = row['Email'] || row['email'];
                    if (ln && fn && em) teachers.push({ firstName: fn, lastName: ln, email: em });
                });
                if (teachers.length > 0) {
                    importTeachers(classId, teachers);
                    alert(`${teachers.length} enseignants importés.`);
                }
                if (fileInputRef.current) fileInputRef.current.value = '';
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
                    if (!schoolId) { alert("Erreur: Aucun établissement lié au compte."); return; }
                    await importPartners(partnersToAdd, schoolId);
                    alert(`${partnersToAdd.length} partenaires importés.`);
                }
                setIsPartnerImporting(false);
            }
        });
    };

    const handleImportStudentCSV = (e: React.ChangeEvent<HTMLInputElement>, classId: string) => {
        const file = e.target.files?.[0];
        if (!file) return;
        Papa.parse(file, {
            header: true, skipEmptyLines: true,
            complete: (results) => {
                const students: Omit<Student, 'id'>[] = [];
                results.data.forEach((row: any) => {
                    const ln = row['Nom'] || row['nom'];
                    const fn = row['Prénom'] || row['prenom'];
                    const em = row['Email'] || row['email'];
                    const bd = row['DATE NAISS'] || row['Date Naiss'];
                    if (ln && fn && em) students.push({ firstName: fn, lastName: ln, email: em, birthDate: bd });
                });
                if (students.length > 0) {
                    importStudents(classId, students);
                    alert(`${students.length} élèves importés.`);
                }
            }
        });
    };

    const handleGenerateCredentials = async (classId: string) => {
        const toastId = toast.loading("Génération des identifiants...");
        try {
            // 1. Generate/Ensure credentials in store
            generateStudentCredentials(classId);

            // Wait for store update
            await new Promise(resolve => setTimeout(resolve, 100));

            const cls = useSchoolStore.getState().classes.find(c => c.id === classId);
            if (!cls || !cls.studentsList || cls.studentsList.length === 0) {
                toast.dismiss(toastId);
                alert("Aucun élève dans cette classe. Veuillez d'abord importer des élèves.");
                return;
            }

            const studentsToPrint = cls.studentsList;

            // 2. Sync with Postgres (Batch Update)
            const invitationsPayload = studentsToPrint.map(s => ({
                userId: s.id,
                tempId: s.tempId,
                tempCode: s.tempCode
            }));

            if (!schoolId) {
                toast.error("Erreur: Identifiant établissement manquant.", { id: toastId });
                return;
            }

            const response = await fetch('/api/school/invitations/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    uai: schoolId,
                    invitations: invitationsPayload
                })
            });

            if (!response.ok) {
                const errProps = await response.json();
                throw new Error(errProps.error || "Échec de la sauvegarde");
            }

            // 3. Generate PDF
            toast.loading("Génération du PDF...", { id: toastId });
            const blob = await pdf(<StudentCredentialsPdf students={studentsToPrint} classInfo={cls} schoolName={schoolName} />).toBlob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Identifiants_${cls.name}.pdf`;
            a.click();

            markCredentialsPrinted(classId, studentsToPrint.map(s => s.id));
            toast.success("Identifiants générés et sauvegardés !", { id: toastId });

        } catch (error: any) {
            console.error("Gen Error:", error);
            toast.error(`Erreur: ${error.message}`, { id: toastId });
        }
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
            const teachersToPrint = cls.teachersList;

            const invitationsPayload = teachersToPrint.map(t => ({
                userId: t.id,
                tempId: t.tempId,
                tempCode: t.tempCode
            }));

            if (!schoolId) {
                toast.error("Erreur: Identifiant établissement manquant.", { id: toastId });
                return;
            }

            const response = await fetch('/api/school/invitations/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uai: schoolId, invitations: invitationsPayload })
            });

            if (!response.ok) throw new Error("Échec de la sauvegarde");

            const blob = await pdf(<TeacherCredentialsPdf teachers={teachersToPrint} schoolName={schoolName} classInfo={cls} />).toBlob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Identifiants_Profs_${cls.name}.pdf`;
            a.click();

            markTeacherCredentialsPrinted(classId, teachersToPrint.map(t => t.id));
            toast.success("Identifiants enseignants générés !", { id: toastId });

        } catch (error: any) {
            console.error("Gen Error:", error);
            toast.error(`Erreur: ${error.message}`, { id: toastId });
        }
    };

    const checkMefCode = async () => {
        const cleanedMef = newClass.mef.replace(/\s/g, '');
        if (!cleanedMef || cleanedMef.length < 8) return;
        try {
            const resp = await fetch(`https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-lycee_pro-effectifs-niveau-sexe-mef/records?where=mef_bcp_11 like "${cleanedMef}*"&limit=1`);
            const data = await resp.json();
            if (data.results && data.results.length > 0) {
                const r = data.results[0];
                const l = r.mef_bcp_11_lib_l || "Formation inconnue";
                setNewClass(prev => ({ ...prev, label: l, diploma: r.mef_bcp_6_lib_l || "", name: prev.name || l }));
            } else {
                if (confirm("MEF non trouvé. Mode manuel ?")) setIsManualMode(true);
            }
        } catch (err) { setIsManualMode(true); }
    };

    const handleAddClass = (e: React.FormEvent) => {
        e.preventDefault();
        addClass({ ...newClass, studentCount: 0, teacherCount: 0, teachersList: [], studentsList: [], pfmpPeriods: [] });
        setNewClass({ name: '', mef: '', label: '', diploma: '', mainTeacher: { firstName: '', lastName: '', email: '' }, cpe: { firstName: '', lastName: '', email: '' } });
    };

    // Dynamic Header Content
    return (
        <div className="space-y-6">
            {role === 'ddfpt' ? (
                // BLOC DDFPT
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Espace DDFPT</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Gérez vos conventions de stage et signatures.
                        <br />
                        Gérez votre établissement, vos classes et vos partenaires.
                    </p>
                </div>
            ) : role === 'business_manager' ? (
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Espace Bureau des Entreprises</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Gérez les partenariats entreprises et les conventions.
                    </p>
                </div>
            ) : role === 'cpe' ? (
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Espace Vie Scolaire (CPE)</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Suivi des élèves et des classes.
                    </p>
                </div>
            ) : (
                // BLOC CHEF D'ETABLISSEMENT (Standard) or others
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Espace Chef d'Établissement</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Gérez votre établissement, vos classes et vos partenaires.
                    </p>
                </div>
            )}

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
                                                        {cls.mainTeacher && (
                                                            <>
                                                                <span className="text-gray-300">|</span>
                                                                <span className="flex items-center text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100" title="Professeur Principal">
                                                                    <Star className="w-3 h-3 mr-1 fill-amber-500 text-amber-500" />
                                                                    <span className="font-medium">PP: {cls.mainTeacher.firstName.charAt(0)}. {cls.mainTeacher.lastName}</span>
                                                                </span>
                                                            </>
                                                        )}
                                                        {cls.cpe && (
                                                            <>
                                                                <span className="text-gray-300">|</span>
                                                                <span className="flex items-center text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100" title="Conseiller Principal d'Éducation">
                                                                    <GraduationCap className="w-3 h-3 mr-1 text-indigo-600" />
                                                                    <span className="font-medium">CPE: {cls.cpe.firstName.charAt(0)}. {cls.cpe.lastName}</span>
                                                                </span>
                                                            </>
                                                        )}
                                                    </p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => {
                                                        const isExpanding = expandedStudentClassId !== cls.id;
                                                        setExpandedStudentClassId(isExpanding ? cls.id : null);
                                                        if (isExpanding && (!cls.studentsList || cls.studentsList.length === 0)) {
                                                            fetchClassStudents(cls.id);
                                                        }
                                                    }} className="px-3 py-1.5 text-xs font-medium text-orange-700 bg-orange-50 rounded-lg border border-orange-100 hover:bg-orange-100">Élèves</button>
                                                    <button onClick={(e) => {
                                                        e.stopPropagation();
                                                        const isExpanding = expandedClassId !== cls.id;
                                                        setExpandedClassId(isExpanding ? cls.id : null);
                                                        setExpandedStudentClassId(null); // Close students view if open
                                                        if (isExpanding && (!cls.teachersList || cls.teachersList.length === 0)) {
                                                            fetchClassTeachers(cls.id);
                                                        }
                                                    }} className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg border border-blue-100 hover:bg-blue-100">Équipe</button>
                                                    <button onClick={() => removeClass(cls.id)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            </div>
                                            {expandedStudentClassId === cls.id && (
                                                <div className="p-4 bg-white border-t border-gray-100">
                                                    <div className="flex justify-between items-center mb-4">
                                                        <h6 className="text-sm font-bold text-gray-700">Liste des élèves</h6>
                                                        <button onClick={() => handleGenerateCredentials(cls.id)} className="text-xs text-purple-600 hover:underline">Générer les identifiants et mots de passe provisoires pour cette classe.</button>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                                        {cls.studentsList?.map(s => (
                                                            <div key={s.id} className="p-2 bg-gray-50 rounded border border-gray-100 flex justify-between text-xs">
                                                                <div className="flex flex-col">
                                                                    <span>{s.firstName} {s.lastName}</span>
                                                                    {s.birthDate && <span className="text-[10px] text-gray-400">Né(e) le {new Date(s.birthDate).toLocaleDateString()}</span>}
                                                                </div>
                                                                <button onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (window.confirm("Attention : Il est préférable de recharger la liste depuis un fichier CSV pour garantir la cohérence des données. \n\nVoulez-vous vraiment supprimer cet utilisateur manuellement ?")) {
                                                                        removeStudentFromClass(cls.id, s.id);
                                                                    }
                                                                }} className="text-gray-400 hover:text-red-500"><X className="w-3 h-3" /></button>
                                                            </div>
                                                        ))}
                                                        {(!cls.studentsList || cls.studentsList.length === 0) && <p className="text-xs text-gray-400 italic">Aucun élève.</p>}
                                                    </div>
                                                </div>
                                            )}

                                            {expandedClassId === cls.id && (
                                                <div className="p-4 bg-white border-t border-blue-100">
                                                    <div className="flex justify-between items-center mb-4">
                                                        <h6 className="text-sm font-bold text-blue-700">Équipe Pédagogique</h6>
                                                        <div className="flex items-center gap-4">
                                                            <button onClick={() => handleGenerateTeacherCredentials(cls.id)} className="text-xs text-purple-600 hover:underline">Générer les identifiants pour les professeurs</button>
                                                            <span className="text-xs text-blue-400 italic">★ Professeur Principal</span>
                                                        </div>
                                                    </div>

                                                    <div className="mb-6 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                                                        <label className="block text-xs font-bold text-indigo-800 mb-2 flex items-center">
                                                            <Users className="w-3 h-3 mr-1" /> Conseiller Principal d'Éducation (CPE)
                                                        </label>
                                                        <div className="flex items-center gap-2">
                                                            <select
                                                                value={cls.cpe?.id || ''}
                                                                onChange={(e) => {
                                                                    const selectedId = e.target.value;
                                                                    if (!selectedId) {
                                                                        updateClass(cls.id, { cpe: undefined });
                                                                    } else {
                                                                        const collaborator = collaborators.find(c => c.id === selectedId);
                                                                        if (collaborator) {
                                                                            updateClass(cls.id, {
                                                                                cpe: {
                                                                                    id: collaborator.id,
                                                                                    firstName: collaborator.name.split(' ')[0], // Approximate simple mapping
                                                                                    lastName: collaborator.name.split(' ').slice(1).join(' '),
                                                                                    email: collaborator.email
                                                                                }
                                                                            });
                                                                        }
                                                                    }
                                                                }}
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="w-full text-xs border-indigo-200 rounded text-indigo-900 focus:ring-indigo-500 focus:border-indigo-500"
                                                            >
                                                                <option value="">Sélectionner un CPE...</option>
                                                                {collaborators
                                                                    .filter(c => c.role === 'cpe')
                                                                    .map(c => (
                                                                        <option key={c.id} value={c.id}>{c.name}</option>
                                                                    ))
                                                                }
                                                            </select>
                                                            {cls.cpe && (
                                                                <div className="text-[10px] text-indigo-600 font-medium whitespace-nowrap px-2 py-1 bg-white rounded border border-indigo-100">
                                                                    Affecté: {cls.cpe.firstName} {cls.cpe.lastName}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                                        {cls.teachersList?.map(t => {
                                                            const isMain = cls.mainTeacher?.id === t.id;
                                                            return (
                                                                <div key={t.id} className={`p-2 rounded border flex justify-between text-xs transition-colors ${isMain ? 'bg-amber-50 border-amber-200 shadow-sm' : 'bg-blue-50 border-blue-100'}`}>
                                                                    <div className="flex items-center">
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                if (isMain) {
                                                                                    // Toggle OFF (Unset)
                                                                                    // updateClass(cls.id, { mainTeacher: undefined }); // Passing undefined might be tricky with partials, using null logic via any cast or just empty object?
                                                                                    // Store expectation: updates.mainTeacher (if present).
                                                                                    // We cast to any to allow passing explicit undefined/null if Typescript strict mode complains about optional.
                                                                                    // Actually ClassDefinition says mainTeacher?: SchoolStaff.
                                                                                    updateClass(cls.id, { mainTeacher: undefined });
                                                                                } else {
                                                                                    // Toggle ON
                                                                                    updateClass(cls.id, {
                                                                                        mainTeacher: {
                                                                                            id: t.id,
                                                                                            firstName: t.firstName,
                                                                                            lastName: t.lastName,
                                                                                            email: t.email || ''
                                                                                        }
                                                                                    });
                                                                                }
                                                                            }}
                                                                            className={`mr-2 focus:outline-none transition-transform active:scale-95 ${isMain ? 'text-amber-500' : 'text-gray-300 hover:text-amber-400'}`}
                                                                            title={isMain ? "Retirer Professeur Principal" : "Définir comme Professeur Principal"}
                                                                        >
                                                                            <Star className={`w-4 h-4 ${isMain ? 'fill-current' : ''}`} />
                                                                        </button>
                                                                        <div className="flex items-center">
                                                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold mr-2 ${isMain ? 'bg-amber-100 text-amber-700' : 'bg-blue-200 text-blue-700'}`}>
                                                                                {t.firstName.charAt(0)}{t.lastName.charAt(0)}
                                                                            </div>
                                                                            <span className={isMain ? 'font-bold text-amber-900' : 'text-blue-900'}>{t.firstName} {t.lastName}</span>
                                                                        </div>
                                                                    </div>
                                                                    <button onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (window.confirm("Attention : Il est préférable de recharger la liste depuis un fichier CSV pour garantir la cohérence des données. \n\nVoulez-vous vraiment supprimer cet utilisateur manuellement ?")) {
                                                                            removeTeacherFromClass(cls.id, t.id);
                                                                        }
                                                                    }} className="text-blue-300 hover:text-red-500"><X className="w-3 h-3" /></button>
                                                                </div>
                                                            );
                                                        })}
                                                        {(!cls.teachersList || cls.teachersList.length === 0) && <p className="text-xs text-blue-400 italic">Aucun enseignant affecté.</p>}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {classes.length === 0 && <p className="text-sm text-gray-500 italic text-center py-8">Aucune classe configurée. Commencez par importer la structure.</p>}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'partners' && (
                        <div className="space-y-6">
                            <div className="bg-white p-6 rounded-lg border border-gray-200 flex items-center justify-between shadow-sm">
                                <div>
                                    <h4 className="font-bold text-gray-900">Base de données Partenaires</h4>
                                    <p className="text-sm text-gray-500">Importez vos entreprises partenaires pour la recherche élève.</p>
                                </div>
                                <button onClick={() => partnerFileInputRef.current?.click()} disabled={isPartnerImporting} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center shadow-lg transition-all transform active:scale-95">
                                    {isPartnerImporting ? <Loader2 className="animate-spin w-5 h-5 mr-2" /> : <FileSpreadsheet className="w-5 h-5 mr-2" />}
                                    Importer Partenaires (CSV)
                                </button>
                                <input type="file" ref={partnerFileInputRef} onChange={handlePartnerImportCSV} accept=".csv" className="hidden" />
                            </div>

                            <div className="flex flex-wrap gap-4 items-center bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <span className="text-sm font-bold text-gray-700 flex items-center"><Search className="w-4 h-4 mr-2" /> Visibilité :</span>
                                <CheckableDropdown label="Activités" options={uniqueActivities} selected={visibleActivities} onChange={handleActivityChange} />
                                <CheckableDropdown label="Filières" options={uniqueJobs} selected={visibleJobs} onChange={handleJobChange} />
                            </div>

                            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">SIRET</th>
                                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Nom</th>
                                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Filières</th>
                                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {filteredPartners.map(p => (
                                                <tr key={p.siret} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 text-sm font-mono text-gray-500">{p.siret}</td>
                                                    <td className="px-6 py-4 text-sm font-bold text-gray-900">{p.name}</td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-wrap gap-1">
                                                            {p.jobs?.map((j, i) => <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold">{j}</span>)}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button onClick={() => removePartner(p.siret)} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {partnerCompanies.length === 0 && <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500 italic">Aucun partenaire enregistré.</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'identity' && (
                        <div className="max-w-2xl space-y-6">
                            <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
                                <h4 className="text-lg font-bold text-gray-900 mb-6 flex items-center"><Building className="w-6 h-6 mr-3 text-orange-600" /> Identité de l'établissement</h4>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Nom</label>
                                        <input type="text" value={schoolName || ''} onChange={(e) => updateSchoolIdentity({ schoolName: e.target.value })} className="w-full border-gray-300 rounded-lg text-sm" disabled={!canEditIdentity} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Adresse</label>
                                        <textarea rows={3} value={schoolAddress || ''} onChange={(e) => updateSchoolIdentity({ schoolAddress: e.target.value })} className="w-full border-gray-300 rounded-lg text-sm" disabled={!canEditIdentity} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">Téléphone</label>
                                            <input type="text" value={schoolPhone || ''} onChange={(e) => updateSchoolIdentity({ schoolPhone: e.target.value })} className="w-full border-gray-300 rounded-lg text-sm" disabled={!canEditIdentity} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">UAI</label>
                                            <div className="relative">
                                                <input type="text" value={profileData?.uai || schoolId || ''} className="w-full bg-gray-50 border-gray-200 rounded-lg text-sm text-gray-500 font-mono" disabled />
                                                {!(profileData?.uai || schoolId) && (
                                                    <span className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded border border-red-200 flex items-center">
                                                        <AlertTriangle className="w-3 h-3 mr-1" /> UAI NON DÉTECTÉ
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="pt-4 border-t border-gray-100">
                                        <h5 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Chef d'établissement</h5>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-1">Prénom & Nom</label>
                                                <input type="text" value={schoolHeadName || ''} onChange={(e) => updateSchoolIdentity({ schoolHeadName: e.target.value })} className="w-full border-gray-300 rounded-lg text-sm" disabled={!canEditIdentity} />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-1">Email académique</label>
                                                <input type="email" value={schoolHeadEmail || ''} onChange={(e) => updateSchoolIdentity({ schoolHeadEmail: e.target.value })} className="w-full border-gray-300 rounded-lg text-sm" disabled={!canEditIdentity} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'pfmp' && <ClassCalendarManager />}

                    {activeTab === 'config' && (
                        <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm max-w-2xl">
                            <h4 className="text-lg font-bold text-gray-900 mb-2 flex items-center"><Sparkles className="w-5 h-5 mr-3 text-purple-600" /> Types de Convention</h4>
                            <p className="text-sm text-gray-500 mb-8 font-medium">Activez les modèles autorisés pour vos élèves.</p>
                            <div className="space-y-3">
                                {[
                                    { id: 'PFMP_STANDARD', label: 'PFMP Lycée Professionnel (Standard)' },
                                    { id: 'STAGE_2NDE', label: 'Stage de Seconde' },
                                    { id: 'ERASMUS_MOBILITY', label: 'Mobilité Erasmus+' },
                                    { id: 'BTS_INTERNSHIP', label: 'Convention de stage BTS' }
                                ].map(type => (
                                    <div key={type.id} className="flex items-center p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                                        <input
                                            type="checkbox"
                                            id={type.id}
                                            checked={allowedConventionTypes?.includes(type.id)}
                                            onChange={(e) => toggleConventionType(type.id, e.target.checked)}
                                            className="w-5 h-5 text-blue-600 rounded border-gray-300"
                                        />
                                        <label htmlFor={type.id} className="ml-4 block text-sm font-bold text-gray-900 cursor-pointer">{type.label}</label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'collaborators' && (
                        <div className="space-y-8 max-w-4xl">
                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center"><UserPlus className="w-4 h-4 mr-2 text-blue-600" /> Ajouter un collaborateur</h4>
                                <form onSubmit={handleAddCollaborator} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                    <div className="md:col-span-1">
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Rôle</label>
                                        <select value={newCollab.role} onChange={e => setNewCollab({ ...newCollab, role: e.target.value as CollaboratorRole })} className="w-full text-sm border-gray-300 rounded-lg">
                                            {Object.entries(COLLABORATOR_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                        </select>
                                    </div>
                                    <div className="md:col-span-1">
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nom / Prénom</label>
                                        <input type="text" value={newCollab.name} onChange={e => setNewCollab({ ...newCollab, name: e.target.value })} className="w-full text-sm border-gray-300 rounded-lg" required />
                                    </div>
                                    <div className="md:col-span-1">
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Email</label>
                                        <input type="email" value={newCollab.email} onChange={e => setNewCollab({ ...newCollab, email: e.target.value })} className="w-full text-sm border-gray-300 rounded-lg" required />
                                    </div>
                                    <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors h-[38px] flex items-center justify-center">Ajouter</button>
                                </form>
                            </div>
                            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                                <div className="p-4 border-b border-gray-100 bg-gray-50"><h5 className="font-bold text-gray-700">Collaborateurs actuels ({collaborators.length})</h5></div>
                                <div className="divide-y divide-gray-100">
                                    {collaborators.map(c => (
                                        <div key={c.id} className="p-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                                            <div className="flex items-center">
                                                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-4 text-blue-700 font-bold">{c.name.charAt(0)}</div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-900">{c.name}</p>
                                                    <p className="text-xs text-gray-500">{c.email}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-[10px] font-bold uppercase tracking-wider">{COLLABORATOR_LABELS[c.role]}</span>
                                                <button onClick={() => {
                                                    if (confirm("Voulez-vous vraiment retirer ce collaborateur de l'établissement ?")) {
                                                        removeCollaborator(c.id);
                                                    }
                                                }} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'rgpd' && (
                        <div className="max-w-4xl mx-auto space-y-8">
                            {/* Information Callout */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start">
                                <Info className="w-6 h-6 text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
                                <div>
                                    <h5 className="text-sm font-bold text-blue-900 mb-1">Mise à jour du Registre des Traitements (Art. 30 RGPD)</h5>
                                    <p className="text-sm text-blue-800 leading-relaxed">
                                        Comme vous le savez déjà, l’usage d’une application de traitement de données à caractère personnel implique son inscription au registre des activités de traitement, document obligatoire à tenir à jour et à disposition de la CNIL.
                                        <br /><br />
                                        Cette formalité s'inscrit dans la continuité des traitements institutionnels déjà recensés par votre établissement dans ce registre (tels que Siècle, Cyclades, Aplypro, Parcoursup ou Pronote).
                                        <br /><br />
                                        Afin de simplifier cette démarche administrative, nous avons synthétisé ci-dessous les informations techniques et juridiques requises. Ces éléments sont pré-qualifiés et prêts à être versés à votre dossier de conformité.
                                    </p>
                                </div>
                            </div>

                            {/* Section A: Identité et Finalités */}
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                                    <h4 className="text-lg font-bold text-gray-900 flex items-center">
                                        <ClipboardList className="w-5 h-5 mr-2 text-gray-600" /> Identité et Finalités
                                    </h4>
                                </div>
                                <div className="p-6">
                                    <table className="min-w-full text-sm">
                                        <tbody className="divide-y divide-gray-100">
                                            <tr><td className="py-3 font-bold w-1/3 text-gray-700">Nom du traitement</td><td className="py-3 text-gray-600">Gestion des Périodes de Formation en Milieu Professionnel (PFMP) et conventions de stage.</td></tr>
                                            <tr><td className="py-3 font-bold text-gray-700">Responsable de traitement</td><td className="py-3 text-gray-600">Le Chef d'Établissement.</td></tr>
                                            <tr><td className="py-3 font-bold text-gray-700">Finalités</td><td className="py-3 text-gray-600">Suivi pédagogique et administratif des stages, dématérialisation des conventions, suivi des signatures.</td></tr>
                                            <tr><td className="py-3 font-bold text-gray-700">Personnes concernées</td><td className="py-3 text-gray-600">Élèves, Responsables légaux, Équipe éducative, Tuteurs en entreprise.</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Section B: Hébergement Souverain et Sécurité */}
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                                    <h4 className="text-lg font-bold text-gray-900 flex items-center">
                                        <ShieldCheck className="w-5 h-5 mr-2 text-green-600" /> Hébergement Souverain et Sécurité
                                    </h4>
                                    <span className="text-xs font-bold px-2 py-1 bg-green-100 text-green-700 rounded border border-green-200 flex items-center">
                                        <Server className="w-3 h-3 mr-1" /> Données en France
                                    </span>
                                </div>
                                <div className="p-6">
                                    <table className="min-w-full text-sm">
                                        <tbody className="divide-y divide-gray-100">
                                            <tr><td className="py-3 font-bold w-1/3 text-gray-700">Sous-traitant (Hébergement)</td><td className="py-3 text-gray-600">Scaleway (Groupe Iliad) – Opérateur de cloud français.</td></tr>
                                            <tr><td className="py-3 font-bold text-gray-700">Localisation des données</td><td className="py-3 text-gray-600">France (Datacenters en Île-de-France). Aucun transfert hors de l'Union Européenne.</td></tr>
                                            <tr><td className="py-3 font-bold text-gray-700">Garantie de Souveraineté</td><td className="py-3 text-gray-600">Données régies exclusivement par le droit français et européen. Protection garantie contre les lois extraterritoriales (type Cloud Act).</td></tr>
                                            <tr>
                                                <td className="py-3 font-bold text-gray-700 align-top">Certifications & Sécurité</td>
                                                <td className="py-3 text-gray-600">
                                                    <ul className="list-disc pl-5 space-y-2">
                                                        <li><strong>ISO/IEC 27001:2022</strong> : Norme de référence pour la gestion de la sécurité de l'information (SMSI) et la gestion des risques.</li>
                                                        <li><strong>SecNumCloud (En cours)</strong> : Entrée officielle en qualification (<strong>Janvier 2025</strong>). Vise la conformité aux exigences de l'<strong>ANSSI</strong> et du <strong>SGDSN</strong> pour les plus hauts niveaux de l'administration française.</li>
                                                        <li><strong>HDS (Hébergeur de Données de Santé)</strong> : Certifié depuis <strong>Juillet 2024</strong>. Conformité aux référentiels de l'<strong>Agence du Numérique en Santé</strong> pour la protection des données sensibles.</li>
                                                        <li>Chiffrement systématique des flux (TLS/SSL) et sauvegardes quotidiennes chiffrées.</li>
                                                    </ul>
                                                </td>
                                            </tr>
                                            <tr><td className="py-3 font-bold text-gray-700">Conservation</td><td className="py-3 text-gray-600">Durée de la scolarité de l'élève + 1 an (archivage courant), puis archivage ou suppression selon les règles en vigueur (Archives de France).</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Support Modals */}
            {importReviewData && (
                <StructureImportReviewModal
                    isOpen={true}
                    onClose={() => setImportReviewData(null)}
                    data={importReviewData}
                    onConfirm={(d) => { if (!schoolId) { alert("Erreur: Aucun établissement lié au compte."); return; } importGlobalStructure(d, schoolId); setImportReviewData(null); }}
                />
            )}
            {teacherImportReviewData && (
                <TeacherImportReviewModal
                    isOpen={true}
                    onClose={() => setTeacherImportReviewData(null)}
                    data={teacherImportReviewData}
                    onConfirm={(d) => { if (!schoolId) { alert("Erreur: Aucun établissement lié au compte."); return; } importGlobalTeachers(d, schoolId); setTeacherImportReviewData(null); }}
                />
            )}
        </div>
    );
}
