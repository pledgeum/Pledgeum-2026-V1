'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { X, Search, Plus, Trash, Edit, Mail, AlertTriangle, ShieldCheck, Download, Users, Briefcase, Sparkles, FileUp, HelpCircle, Archive, Key, Building, GraduationCap, Lock, Shield, FileSpreadsheet, UserPlus, Trash2, Building2, Loader2, ChevronDown, Check } from 'lucide-react';
import { useSchoolStore, COLLABORATOR_LABELS, CollaboratorRole, Teacher, Student, ClassDefinition, PartnerCompany } from '@/store/school';
import { StructureImportReviewModal } from './StructureImportReviewModal';
import { TeacherImportReviewModal } from './TeacherImportReviewModal';
// PartnerImportReviewModal removed (progressive import)
import { useUserStore } from '@/store/user';
import Papa from 'papaparse';
import { useConventionStore } from '@/store/convention'; // Imported for class cross-referencing

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

    // Close on click outside
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
                        <button
                            onClick={() => onChange(options)}
                            className="text-[10px] sm:text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline"
                        >
                            Tout sélectionner
                        </button>
                        <button
                            onClick={() => onChange([])}
                            className="text-[10px] sm:text-xs text-gray-500 hover:text-gray-700 font-medium hover:underline"
                        >
                            Tout désélectionner
                        </button>
                    </div>
                    {options.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-gray-500 italic">Aucune option</div>
                    ) : (
                        options.map((option) => (
                            <div
                                key={option}
                                className="flex items-center px-3 py-2 cursor-pointer hover:bg-gray-100"
                                onClick={() => toggleOption(option)}
                            >
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

import { pdf } from '@react-pdf/renderer';
import { StudentCredentialsPdf } from '@/components/pdf/StudentCredentialsPdf';
import { TeacherCredentialsPdf } from '@/components/pdf/TeacherCredentialsPdf';

interface SchoolAdminModalProps {
    isOpen: boolean;
    onClose: () => void;
}



export function SchoolAdminModal({ isOpen, onClose }: SchoolAdminModalProps) {
    const [activeTab, setActiveTab] = useState<'rgpd' | 'collaborators' | 'classes' | 'config' | 'identity' | 'partners'>('rgpd');
    const {
        collaborators, classes, addCollaborator, removeCollaborator, addClass, removeClass, updateClass,
        importTeachers, addTeacherToClass, removeTeacherFromClass, importGlobalTeachers,
        importStudents, addStudentToClass, removeStudentFromClass, allowedConventionTypes,
        toggleConventionType, schoolHeadEmail, delegatedAdminId, setDelegatedAdmin, schoolName,
        schoolAddress, schoolPhone, schoolHeadName, generateStudentCredentials, importGlobalStructure,
        partnerCompanies, importPartners, removePartner,
        // Visibility Store
        hiddenActivities, setHiddenActivities, hiddenJobs, setHiddenJobs, hiddenClasses, setHiddenClasses,
        restoreTestData
    } = useSchoolStore();
    const { conventions } = useConventionStore();
    // Removed local selected state in favor of derived visibility state

    // Derived Filter Data
    const uniqueActivities = useMemo(() => {
        const set = new Set(partnerCompanies.map(p => p.activity).filter(Boolean));
        return Array.from(set).sort();
    }, [partnerCompanies]);

    const uniqueJobs = useMemo(() => {
        const set = new Set(partnerCompanies.flatMap(p => p.jobs || []).filter(Boolean));
        return Array.from(set).sort();
    }, [partnerCompanies]);

    // Siret -> Classes Map from Conventions
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

    const uniqueClasses = useMemo(() => {
        const set = new Set<string>();
        classesBySiret.forEach(classes => {
            classes.forEach(c => set.add(c));
        });
        return Array.from(set).sort();
    }, [classesBySiret]);

    // Derived Visible Data (UI State)
    const visibleActivities = useMemo(() => uniqueActivities.filter(a => !hiddenActivities.includes(a)), [uniqueActivities, hiddenActivities]);
    const visibleJobs = useMemo(() => uniqueJobs.filter(j => !hiddenJobs.includes(j)), [uniqueJobs, hiddenJobs]);
    const visibleClasses = useMemo(() => uniqueClasses.filter(c => !hiddenClasses.includes(c)), [uniqueClasses, hiddenClasses]);

    // Handlers
    const handleActivityChange = (visible: string[]) => {
        const hidden = uniqueActivities.filter(a => !visible.includes(a));
        setHiddenActivities(hidden);
    };
    const handleJobChange = (visible: string[]) => {
        const hidden = uniqueJobs.filter(j => !visible.includes(j));
        setHiddenJobs(hidden);
    };
    const handleClassChange = (visible: string[]) => {
        const hidden = uniqueClasses.filter(c => !visible.includes(c));
        setHiddenClasses(hidden);
    };

    // Filtered List (Simulating what student sees)
    const filteredPartners = useMemo(() => {
        return partnerCompanies.filter(p => {
            // Activity Filter (Hidden Check)
            if (p.activity && hiddenActivities.includes(p.activity)) return false;

            // Jobs Filter (More complex: Hide if ALL jobs are hidden? Or hide jobs from display?)
            // Requirement: "Student doesn't see them on map".
            // Implementation: We hide the COMPANY if its activity is hidden.
            // For jobs/files: We hide the COMPANY if NONE of its jobs are visible? 
            // Or we just use it as a robust filter: If I uncheck "Plumber", Plumbers disappear.
            if (p.jobs && p.jobs.length > 0) {
                const hasVisibleJob = p.jobs.some(j => !hiddenJobs.includes(j));
                if (!hasVisibleJob) return false;
            }

            // Class Filter
            const partnerClasses = classesBySiret.get(p.siret);
            if (partnerClasses) {
                const hasVisibleClass = Array.from(partnerClasses).some(c => !hiddenClasses.includes(c));
                // If the company is linked ONLY to hidden classes, hide it.
                // If it's linked to NO classes (new partner), it remains visible unless filtering strictly by class.
                // Strategy: If existing links are ALL hidden, hide.
                if (!hasVisibleClass && partnerClasses.size > 0) return false;
            }

            return true;
        });
    }, [partnerCompanies, hiddenActivities, hiddenJobs, hiddenClasses, classesBySiret]);

    const { email } = useUserStore();

    // Permissions
    const isSchoolHead = email && schoolHeadEmail && email.toLowerCase() === schoolHeadEmail.toLowerCase();
    const isDelegatedAdmin = email && collaborators.some(c => c.id === delegatedAdminId && c.email.toLowerCase() === email.toLowerCase());

    const canEditIdentity = isSchoolHead || isDelegatedAdmin || (schoolHeadEmail === "");
    const canDelegate = isSchoolHead || (schoolHeadEmail === "");


    // Validation Logic
    const missingIdentity = useMemo(() => {
        return !schoolName || !schoolAddress || !schoolPhone || !schoolHeadName || !schoolHeadEmail;
    }, [schoolName, schoolAddress, schoolPhone, schoolHeadName, schoolHeadEmail]);

    const missingClasses = useMemo(() => {
        if (classes.length === 0) return true;
        // Requirement: "At least one class, with the main teacher"
        // Check if there is at least one class that has a main teacher assigned.
        // In store/school.ts, Class interface has `mainTeachers` (string, likely ID).
        // Check if there is at least one class that has a main teacher assigned.
        const hasBroadMainTeacher = classes.some(c => c.mainTeacher && c.mainTeacher.lastName);
        return !hasBroadMainTeacher;
    }, [classes]);

    const missingConfig = useMemo(() => {
        return !allowedConventionTypes || allowedConventionTypes.length === 0;
    }, [allowedConventionTypes]);

    // Form States
    const [newCollab, setNewCollab] = useState({ name: '', email: '', role: 'DDFPT' as CollaboratorRole });


    // Teacher Management State
    const [expandedClassId, setExpandedClassId] = useState<string | null>(null);
    const [expandedStudentClassId, setExpandedStudentClassId] = useState<string | null>(null); // New state for student drawer
    const [newTeacher, setNewTeacher] = useState({ firstName: '', lastName: '', email: '' });
    const [newStudent, setNewStudent] = useState({ firstName: '', lastName: '', email: '' }); // New Student State
    const [newClass, setNewClass] = useState({
        name: '',
        mef: '',
        label: '',
        diploma: '',
        mainTeacher: { firstName: '', lastName: '', email: '' },
        cpe: { firstName: '', lastName: '', email: '' }
    });
    const fileInputRef = useRef<HTMLInputElement>(null);
    const studentFileInputRef = useRef<HTMLInputElement>(null);

    // Global Import State
    const [importReviewData, setImportReviewData] = useState<{ className: string; students: Omit<Student, 'id'>[] }[] | null>(null);
    const [teacherImportReviewData, setTeacherImportReviewData] = useState<{ teacher: Omit<Teacher, 'id'>; classes: string[] }[] | null>(null);
    const [showImportHelp, setShowImportHelp] = useState(false);
    const globalFileInputRef = useRef<HTMLInputElement>(null);
    const teacherFileInputRef = useRef<HTMLInputElement>(null);
    const [showTeacherImportReview, setShowTeacherImportReview] = useState(false);
    const [parsedTeachers, setParsedTeachers] = useState<{ teacher: Omit<Teacher, 'id'>, classes: string[] }[]>([]);


    const partnerFileInputRef = useRef<HTMLInputElement>(null);

    const handleGlobalImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            delimiter: ";", // As requested by user
            encoding: "ISO-8859-1", // Common for French windows exports, though UTF-8 is standard.
            complete: (results) => {
                const map = new Map<string, Omit<Student, 'id'>[]>();

                results.data.forEach((row: any) => {
                    // Columns: NOM;PRENOM;DATE NAISS;CLASSES
                    const nom = row['NOM'] || row['Nom'];
                    const prenom = row['PRENOM'] || row['Prénom'];
                    const dateNaiss = row['DATE NAISS'] || row['Date Naiss'] || row['Né(e) le'];
                    const classeRaw = row['CLASSES'] || row['Classe'] || row['Division'];

                    if (nom && prenom && classeRaw) {
                        // Handle multiple classes? Typically "2NDE1". 
                        const className = classeRaw.split(',')[0].trim();

                        const student: Omit<Student, 'id'> = {
                            firstName: prenom,
                            lastName: nom,
                            birthDate: dateNaiss
                            // email is optional/missing
                        };

                        if (!map.has(className)) {
                            map.set(className, []);
                        }
                        map.get(className)?.push(student);
                    }
                });

                const structure = Array.from(map.entries()).map(([className, students]) => ({
                    className,
                    students
                }));

                if (structure.length > 0) {
                    setImportReviewData(structure);
                } else {
                    alert("Aucune donnée valide trouvée. Vérifiez les colonnes : NOM, PRENOM, DATE NAISS, CLASSES");
                }

                if (globalFileInputRef.current) globalFileInputRef.current.value = '';
            },
            error: (err) => {
                console.error(err);
                alert("Erreur de lecture du fichier CSV.");
            }
        });
    };

    const handleTeacherImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            delimiter: ";", // As requested
            encoding: "ISO-8859-1",
            complete: (results) => {
                const teachersToImport: { teacher: Omit<Teacher, 'id'>; classes: string[] }[] = [];

                results.data.forEach((row: any) => {
                    // Columns: NOM;PRENOM;DATE NAISS;CLASSES
                    const nom = row['NOM'] || row['Nom'];
                    const prenom = row['PRENOM'] || row['Prénom'];
                    const dateNaiss = row['DATE NAISS'] || row['Date Naiss'] || row['Né(e) le'];
                    const classesRaw = row['CLASSES'] || row['Classes'] || row['Division']; // Comma separated

                    if (nom && prenom) {
                        const classList = classesRaw ? classesRaw.split(',').map((c: string) => c.trim()).filter((c: string) => c.length > 0) : [];

                        if (classList.length > 0) {
                            teachersToImport.push({
                                teacher: {
                                    firstName: prenom,
                                    lastName: nom,
                                    email: "", // Optional
                                    birthDate: dateNaiss
                                },
                                classes: classList
                            });
                        }
                    }
                });

                if (teachersToImport.length > 0) {
                    setTeacherImportReviewData(teachersToImport);
                } else {
                    alert("Aucun enseignant valide trouvé avec des classes assignées. Vérifiez les colonnes : NOM, PRENOM, DATE NAISS, CLASSES");
                }

                if (teacherFileInputRef.current) teacherFileInputRef.current.value = "";
            },
            error: (err) => {
                console.error(err);
                alert("Erreur de lecture du CSV.");
            }
        });
    };

    const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>, classId: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const teachers: Omit<Teacher, 'id'>[] = [];
                results.data.forEach((row: any) => {
                    const lastName = row['Nom'] || row['nom'];
                    const firstName = row['Prénom'] || row['prenom'] || row['Prenom'];
                    const email = row['Email'] || row['email'] || row['Courriel'] || row['courriel'];
                    if (lastName && firstName && email) teachers.push({ firstName, lastName, email });
                });

                if (teachers.length > 0) {
                    importTeachers(classId, teachers);
                    alert(`${teachers.length} enseignants importés avec succès.`);
                } else {
                    alert("Aucun enseignant valide trouvé dans le CSV. Vérifiez les colonnes (Nom, Prénom, Email).");
                }
                if (fileInputRef.current) fileInputRef.current.value = '';
            },
            error: (error) => { console.error("CSV Import Error:", error); alert("Erreur lors de l'import CSV."); }
        });
    };

    const [isPartnerImporting, setIsPartnerImporting] = useState(false);

    const handlePartnerImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) {
            console.log("No file selected");
            return;
        }

        // Allow re-selecting the same file even if it failed previously
        e.target.value = '';

        console.log("File selected:", file.name);
        setIsPartnerImporting(true);
        // alert(`Analyse du fichier "${file.name}" en cours... Veuillez patienter.`); // Removed in favor of spinner

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            // delimiter: ";", // Let PapaParse auto-detect
            // encoding: "ISO-8859-1", // Let browser/PapaParse handle encoding
            complete: async (results) => {
                console.log("Parse complete. Rows:", results.data.length);
                console.log("Fields:", results.meta.fields);

                // Helper to find key case-insensitively
                const findKey = (row: any, search: string[]) => {
                    const keys = Object.keys(row);
                    for (const k of keys) {
                        const normK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                        for (const s of search) {
                            if (normK.includes(s.toLowerCase())) return row[k];
                        }
                    }
                    return '';
                };

                // Process each row
                let processedCount = 0;
                let addedCount = 0;

                for (const row of results.data as any[]) {
                    processedCount++;
                    // Flexible Column Matching
                    const activite = findKey(row, ['activite', 'activity']) || '';
                    const metiersRaw = findKey(row, ['metier', 'job', 'poste']) || '';
                    const siretRaw = findKey(row, ['siret', 'lieusiret']) || '';

                    // Basic Validation
                    if (!siretRaw) continue;

                    // Clean SIRET
                    const siret = siretRaw.replace(/[^0-9]/g, ''); // Keep only digits
                    if (siret.length !== 14) continue;

                    // Parse Jobs
                    const jobs = metiersRaw
                        ? metiersRaw.split(/[;,]/).map((j: string) => j.trim()).filter((j: string) => j.length > 0)
                        : [];

                    let partnerToAdd: PartnerCompany | null = null;

                    // API Lookup for Enrichment
                    try {
                        const response = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${siret}&limit=1`);
                        if (response.ok) {
                            const apiData = await response.json();
                            if (apiData.results && apiData.results.length > 0) {
                                const company = apiData.results[0];
                                partnerToAdd = {
                                    siret: siret,
                                    name: company.nom_complet || company.nom_raison_sociale || `Entreprise ${siret}`,
                                    address: company.siege.adresse || company.siege.geo_adresse || '',
                                    city: company.siege.libelle_commune || '',
                                    postalCode: company.siege.code_postal || '',
                                    coordinates: (company.siege.latitude && company.siege.longitude)
                                        ? { lat: parseFloat(company.siege.latitude), lng: parseFloat(company.siege.longitude) }
                                        : undefined,
                                    activity: activite,
                                    jobs: jobs
                                };
                            } else {
                                console.warn(`SIRET ${siret} not found in API.`);
                                partnerToAdd = {
                                    siret: siret,
                                    name: `Entreprise ${siret} (Non trouvée API)`,
                                    address: 'Adresse inconnue',
                                    city: '',
                                    postalCode: '',
                                    activity: activite,
                                    jobs: jobs
                                };
                            }
                        } else {
                            console.warn(`API Error for SIRET ${siret}: ${response.status}`);
                            partnerToAdd = {
                                siret: siret,
                                name: `Entreprise ${siret} (Erreur API)`,
                                address: '',
                                city: '',
                                postalCode: '',
                                activity: activite,
                                jobs: jobs
                            };
                        }
                    } catch (err) {
                        console.warn(`Failed to fetch info for SIRET ${siret}`, err);
                        partnerToAdd = {
                            siret: siret,
                            name: `Entreprise ${siret} (Erreur Réseau)`,
                            address: '',
                            city: '',
                            postalCode: '',
                            activity: activite,
                            jobs: jobs
                        };
                    }

                    // Add to store immediately if valid
                    if (partnerToAdd) {
                        importPartners([partnerToAdd]);
                        addedCount++;
                    }

                    // Delay to prevent API flooding and allow UI update
                    await new Promise(r => setTimeout(r, 100));
                }

                console.log(`Processed ${processedCount} rows. Added ${addedCount} candidates progressively.`);
                setIsPartnerImporting(false); // Stop loader

                if (addedCount === 0) {
                    alert(`Aucune entreprise valide trouvée.\n\nColonnes détectées: ${results.meta.fields?.join(', ')}\nLignes analysées: ${processedCount}`);
                } else {
                    // Optional: Summary alert, or just silence if user sees the list growing
                    // alert(`Import terminé : ${addedCount} entreprises traitées.`);
                }

                // Reset file input
                if (partnerFileInputRef.current) partnerFileInputRef.current.value = '';
            },
            error: (error) => {
                setIsPartnerImporting(false); // Stop loader
                console.error("CSV Import Error:", error);
                alert(`Erreur technique lors de l'import CSV: ${error.message}`);
                if (partnerFileInputRef.current) partnerFileInputRef.current.value = '';
            }
        });
    };
    const handleImportStudentCSV = (e: React.ChangeEvent<HTMLInputElement>, classId: string) => {
        const file = e.target.files?.[0]; // Added this line, it was missing
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const students: Omit<Student, 'id'>[] = [];
                results.data.forEach((row: any) => {
                    const lastName = row['Nom'] || row['nom'];
                    const firstName = row['Prénom'] || row['prenom'] || row['Prenom'];
                    const email = row['Email'] || row['email'] || row['Courriel'] || row['courriel'];
                    if (lastName && firstName && email) students.push({ firstName, lastName, email });
                });

                if (students.length > 0) {
                    importStudents(classId, students);
                    alert(`${students.length} élèves importés avec succès.`);
                } else {
                    alert("Aucun élève valide trouvé dans le CSV. Vérifiez les colonnes (Nom, Prénom, Email).");
                }
                if (studentFileInputRef.current) studentFileInputRef.current.value = '';
            },
            error: (error) => { console.error("CSV Import Error:", error); alert("Erreur lors de l'import CSV."); }
        });
    };

    const handleGenerateCredentials = async (classId: string) => {
        console.log("Starting generation for class:", classId);
        try {
            // 1. Generate/Ensure credentials in store
            generateStudentCredentials(classId);
            console.log("Credentials generated in store.");

            // 2. Get updated class data
            const updatedClasses = useSchoolStore.getState().classes;
            const cls = updatedClasses.find(c => c.id === classId);
            console.log("Class found:", cls?.name, "Students:", cls?.studentsList?.length);

            if (!cls || !cls.studentsList || cls.studentsList.length === 0) {
                alert("Aucun élève dans cette classe. Veuillez d'abord importer des élèves.");
                return;
            }

            // 3. Generate PDF Blob
            console.log("Generating PDF blob...");
            const blob = await pdf(
                <StudentCredentialsPdf
                    students={cls.studentsList}
                    classInfo={cls}
                    schoolName={schoolName}
                />
            ).toBlob();
            console.log("PDF Blob created, size:", blob.size);

            // 4. Download (Native)
            console.log("Triggering download...");
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Identifiants_${cls.name.replace(/\s+/g, '_')}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            console.log("Download triggered.");

        } catch (error) {
            console.error("PDF Gen Error Full:", error);
            alert(`Erreur technique: ${(error as Error).message} `);
        }
    };

    const [isManualMode, setIsManualMode] = useState(false);

    const checkMefCode = async () => {
        const cleanedMef = newClass.mef.replace(/\s/g, '');
        if (!cleanedMef || cleanedMef.length < 8) return; // MEF codes are usually 11, but some short ones exist. 8 is safe.

        try {
            // Reset manual mode when searching
            setIsManualMode(false);

            // Using a broader search to catch MEF codes in various fields if needed, OR strict filter
            // Trying strict filter on mef_bcp_11 first as seen in dataset check
            const response = await fetch(`https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-lycee_pro-effectifs-niveau-sexe-mef/records?where=mef_bcp_11 like "${cleanedMef}*"&limit=1`);
            const data = await response.json();

            if (data.results && data.results.length > 0) {
                const record = data.results[0];
                const label = record.mef_bcp_11_lib_l || record.mef_bcp_6_lib_l || "Formation inconnue";
                const diploma = record.mef_bcp_6_lib_l || record.mef_bcp_6 || ""; // Best guess for Diploma/Level
                setNewClass(prev => ({
                    ...prev,
                    label: label,
                    diploma: diploma,
                    name: prev.name || label // Auto-fill name only if empty
                }));
            } else {
                if (confirm(`Code MEF "${cleanedMef}" non trouvé dans la base "Lycée Pro".\n\nVoulez-vous saisir manuellement la dénomination et le diplôme ?`)) {
                    setIsManualMode(true);
                    setNewClass(prev => ({ ...prev, label: '', diploma: '' }));
                }
            }
        } catch (error) {
            console.error("Erreur vérification MEF:", error);
            alert("Erreur technique lors de la vérification. Passage en mode manuel.");
            setIsManualMode(true);
        }
    };

    const handleAddClass = (e: React.FormEvent) => {
        e.preventDefault();
        addClass({
            name: newClass.name,
            mainTeacher: newClass.mainTeacher,
            cpe: newClass.cpe,
            mef: newClass.mef,
            label: newClass.label,
            diploma: newClass.diploma,
            teachersList: [],
            studentsList: []
        });
        setNewClass({
            name: '',
            mef: '',
            label: '',
            diploma: '',
            mainTeacher: { firstName: '', lastName: '', email: '' },
            cpe: { firstName: '', lastName: '', email: '' }
        });
    };

    const handleAutoPopulate = (classId: string) => {
        const dummyTeachers: Omit<Teacher, 'id'>[] = [
            { firstName: 'Alice', lastName: 'Dupont', email: 'alice.dupont@test.com' },
            { firstName: 'Bob', lastName: 'Martin', email: 'bob.martin@test.com' },
            { firstName: 'Charlie', lastName: 'Durand', email: 'charlie.durand@test.com' },
            { firstName: 'David', lastName: 'Leroy', email: 'david.leroy@test.com' },
            { firstName: 'Eva', lastName: 'Moreau', email: 'eva.moreau@test.com' }
        ];
        importTeachers(classId, dummyTeachers);

        // Also populate dummy students for testing
        const dummyStudents: Omit<Student, 'id'>[] = [
            { firstName: 'Student1', lastName: 'A', email: 'student1@test.com' },
            { firstName: 'Student2', lastName: 'B', email: 'student2@test.com' },
            { firstName: 'Student3', lastName: 'C', email: 'student3@test.com' }
        ];
        importStudents(classId, dummyStudents);
    };

    const handleAddTeacher = (e: React.FormEvent, classId: string) => {
        e.preventDefault();
        if (newTeacher.firstName && newTeacher.lastName && newTeacher.email) {
            addTeacherToClass(classId, newTeacher);
            setNewTeacher({ firstName: '', lastName: '', email: '' });
        }
    };

    const handleAddStudent = (e: React.FormEvent, classId: string) => {
        e.preventDefault();
        if (newStudent.firstName && newStudent.lastName && newStudent.email) {
            addStudentToClass(classId, newStudent);
            setNewStudent({ firstName: '', lastName: '', email: '' });
        }
    };

    const handleAddCollaborator = (e: React.FormEvent) => {
        e.preventDefault();
        if (newCollab.name && newCollab.email) {
            addCollaborator(newCollab);
            setNewCollab({ name: '', email: '', role: 'DDFPT' });
        }
    };



    // Initialize School Head Email default
    useEffect(() => {
        if (!useSchoolStore.getState().schoolHeadEmail && email) {
            useSchoolStore.getState().updateSchoolIdentity({ schoolHeadEmail: email });
        }
    }, [email]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" >
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-blue-900 text-white rounded-t-xl">
                    <div className="flex items-center space-x-3">
                        <Briefcase className="w-6 h-6" />
                        <div>
                            <h3 className="text-xl font-bold">Administration Établissement</h3>
                            <p className="text-xs text-blue-200">Gérez vos équipes et vos classes</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-blue-200 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200">
                    <button
                        onClick={() => setActiveTab('rgpd')}
                        className={`flex-1 py-4 text-sm font-medium flex items-center justify-center space-x-2 transition-colors relative ${activeTab === 'rgpd' ? 'text-purple-900 border-b-2 border-purple-900 bg-purple-50' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Conformité RGPD</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('identity')}
                        className={`flex-1 py-4 text-sm font-medium flex items-center justify-center space-x-2 transition-colors relative ${activeTab === 'identity' ? 'text-orange-900 border-b-2 border-orange-900 bg-orange-50' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <Building className="w-4 h-4" />
                        <span>Identité Établissement</span>
                        {missingIdentity && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" title="Données manquantes"></span>}
                    </button>
                    <button
                        onClick={() => setActiveTab('collaborators')}
                        className={`flex-1 py-4 text-sm font-medium flex items-center justify-center space-x-2 transition-colors ${activeTab === 'collaborators' ? 'text-blue-900 border-b-2 border-blue-900 bg-blue-50' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <Users className="w-4 h-4" />
                        <span>Collaborateurs</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('classes')}
                        className={`flex-1 py-4 text-sm font-medium flex items-center justify-center space-x-2 transition-colors relative ${activeTab === 'classes' ? 'text-blue-900 border-b-2 border-blue-900 bg-blue-50' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <GraduationCap className="w-4 h-4" />
                        <span>Classes & Professeurs</span>
                        {missingClasses && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" title="Au moins une classe avec Prof. Principal requise"></span>}
                    </button>
                    <button
                        onClick={() => setActiveTab('partners')}
                        className={`flex-1 py-4 text-sm font-medium flex items-center justify-center space-x-2 transition-colors relative ${activeTab === 'partners' ? 'text-blue-900 border-b-2 border-blue-900 bg-blue-50' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <Building2 className="w-4 h-4" />
                        <span>Entreprises & Partenaires</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('config')}
                        className={`flex-1 py-4 text-sm font-medium flex items-center justify-center space-x-2 transition-colors relative ${activeTab === 'config' ? 'text-blue-900 border-b-2 border-blue-900 bg-blue-50' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <Sparkles className="w-4 h-4" />
                        <span>Choix des conventions</span>
                        {missingConfig && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" title="Au moins un type de convention requis"></span>}
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto bg-gray-50 flex-1">
                    {activeTab === 'rgpd' ? (
                        <div className="space-y-6 max-w-4xl mx-auto">
                            <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
                                <h4 className="text-xl font-bold text-gray-900 mb-6 flex items-center border-b border-gray-100 pb-4">
                                    <ShieldCheck className="w-6 h-6 mr-3 text-purple-600" />
                                    Conformité RGPD : Facilitez la mise à jour de votre registre
                                </h4>

                                <div className="prose prose-sm text-gray-600 mb-8 max-w-none">
                                    <p className="font-medium text-gray-900 mb-2">Madame, Monsieur le Chef d'établissement,</p>
                                    <p className="mb-4">
                                        Comme vous le savez, votre établissement tient à jour un <strong>Registre des Activités de Traitement</strong> qui recense l'ensemble des fichiers (élèves, personnels, cantine, etc.) gérés par votre structure.
                                    </p>
                                    <p className="mb-4">
                                        L'utilisation de l'application <strong>Pledgeum</strong> constitue un nouveau traitement de données à ajouter à ce document existant. Pour vous faire gagner du temps et simplifier vos démarches de conformité, nous avons synthétisé ci-dessous les informations techniques prêtes à être reportées dans votre registre.
                                    </p>
                                </div>

                                <div className="bg-purple-50 rounded-lg border border-purple-100 overflow-hidden">
                                    <div className="bg-purple-100 px-4 py-3 border-b border-purple-200">
                                        <h5 className="font-bold text-purple-900 text-sm flex items-center">
                                            <FileUp className="w-4 h-4 mr-2" />
                                            Les éléments à copier/coller dans votre registre :
                                        </h5>
                                    </div>
                                    <div className="divide-y divide-purple-200/50">
                                        <div className="grid grid-cols-1 md:grid-cols-3 p-4 hover:bg-white/50 transition-colors">
                                            <div className="font-semibold text-gray-900 text-sm md:col-span-1">Rubrique du registre</div>
                                            <div className="text-gray-700 text-sm md:col-span-2">Informations concernant Pledgeum</div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 p-4 hover:bg-white/50 transition-colors">
                                            <div className="font-semibold text-gray-900 text-sm md:col-span-1">Finalité</div>
                                            <div className="text-gray-700 text-sm md:col-span-2 space-y-1">
                                                <p>Gestion de conventions de stage</p>
                                                <p>Gestion et suivi des stages et relation alumni au sein de l'établissement.</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 p-4 hover:bg-white/50 transition-colors">
                                            <div className="font-semibold text-gray-900 text-sm md:col-span-1">Catégories de données</div>
                                            <div className="text-gray-700 text-sm md:col-span-2">
                                                <ul className="list-disc list-inside space-y-1">
                                                    <li><strong>Identité :</strong> Nom, Prénom, Classe.</li>
                                                    <li><strong>Fonction Coordonnées :</strong> Email, Téléphone.</li>
                                                    <li><strong>Données de vie scolaire :</strong> absences en stage.</li>
                                                    <li><strong>Données économiques :</strong> Remboursement des frais.</li>
                                                </ul>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 p-4 hover:bg-white/50 transition-colors">
                                            <div className="font-semibold text-gray-900 text-sm md:col-span-1">Destinataires</div>
                                            <div className="text-gray-700 text-sm md:col-span-2">
                                                <ul className="list-disc list-inside space-y-1">
                                                    <li>Services administratifs et comptables de l'établissement.</li>
                                                    <li>La société éditrice de Pledgeum.</li>
                                                </ul>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 p-4 hover:bg-white/50 transition-colors">
                                            <div className="font-semibold text-gray-900 text-sm md:col-span-1">Durée de conservation</div>
                                            <div className="text-gray-700 text-sm md:col-span-2">
                                                Les données sont conservées pendant la durée de la scolarité de l'élève + 1 an ou jusqu'à désinscription puis archivées ou supprimées selon les obligations légales en vigueur.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : activeTab === 'collaborators' ? (
                        <div className="space-y-8">
                            {/* ... (Collaborators Content) ... */}
                            {/* Add Form */}
                            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                                <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center">
                                    <UserPlus className="w-4 h-4 mr-2 text-blue-600" />
                                    Ajouter un collaborateur
                                </h4>
                                <form onSubmit={handleAddCollaborator} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Rôle</label>
                                        <select
                                            value={newCollab.role}
                                            onChange={(e) => setNewCollab({ ...newCollab, role: e.target.value as CollaboratorRole })}
                                            className="w-full text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                        >
                                            {Object.entries(COLLABORATOR_LABELS).map(([key, label]) => (
                                                <option key={key} value={key}>{label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Nom Complet</label>
                                        <input
                                            type="text"
                                            value={newCollab.name}
                                            onChange={(e) => setNewCollab({ ...newCollab, name: e.target.value })}
                                            placeholder="Ex: Jean Dupont"
                                            className="w-full text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Email Académique</label>
                                        <input
                                            type="email"
                                            value={newCollab.email}
                                            onChange={(e) => setNewCollab({ ...newCollab, email: e.target.value })}
                                            placeholder="jean.dupont@ac-..."
                                            className="w-full text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                            required
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-md transition-colors h-[38px]"
                                    >
                                        Ajouter
                                    </button>
                                </form>
                            </div>

                            {/* List */}
                            <div>
                                <h4 className="text-sm font-bold text-gray-900 mb-3">Équipe actuelle ({collaborators.length})</h4>
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden divide-y divide-gray-100">
                                    {collaborators.length === 0 ? (
                                        <p className="p-4 text-sm text-gray-500 text-center italic">Aucun collaborateur ajouté.</p>
                                    ) : (
                                        collaborators.map((collab) => (
                                            <div key={collab.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                                                <div className="flex items-center space-x-4">
                                                    <div className="bg-blue-100 p-2 rounded-full">
                                                        <Users className="w-4 h-4 text-blue-700" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-gray-900">{collab.name}</p>
                                                        <p className="text-xs text-gray-500">{collab.email}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center space-x-6">
                                                    {delegatedAdminId === collab.id ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 border border-green-200" title="Ce collaborateur a les droits d'ajout des équipes et structures">
                                                            <Shield className="w-3 h-3 mr-1" />
                                                            Droits d'ajout des équipes et structures
                                                            {canDelegate && (
                                                                <button onClick={() => setDelegatedAdmin(null)} className="ml-2 text-green-600 hover:text-green-900">
                                                                    <X className="w-3 h-3" />
                                                                </button>
                                                            )}
                                                        </span>
                                                    ) : (
                                                        canDelegate && (
                                                            <button
                                                                onClick={() => setDelegatedAdmin(collab.id)}
                                                                className="flex items-center text-gray-400 hover:text-purple-600 transition-colors text-xs"
                                                                title="Déléguer la gestion établissement"
                                                            >
                                                                <Shield className="w-4 h-4 mr-1" />
                                                                Déléguer la gestion établissement
                                                            </button>
                                                        )
                                                    )}
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                        {COLLABORATOR_LABELS[collab.role]}
                                                    </span>
                                                    <button
                                                        onClick={() => removeCollaborator(collab.id)}
                                                        className="text-gray-400 hover:text-red-600 transition-colors"
                                                        title="Supprimer"
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
                    ) : activeTab === 'classes' ? (

                        <div className="space-y-8">
                            {/* Add Class Form */}
                            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                                <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center">
                                    <Sparkles className="w-4 h-4 mr-2 text-purple-600" />
                                    Imports Globaux
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Structure Import */}
                                    <div className="p-4 bg-green-50 rounded-lg border border-green-100 flex items-center justify-between">
                                        <div className="flex items-center">
                                            <FileSpreadsheet className="w-5 h-5 mr-3 text-green-600" />
                                            <div>
                                                <h5 className="font-bold text-green-900 text-sm">Structure</h5>
                                                <p className="text-xs text-green-700">Classes et Élèves</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => globalFileInputRef.current?.click()}
                                                className="text-xs flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors shadow-sm"
                                            >
                                                <FileUp className="w-4 h-4" />
                                                Importer
                                            </button>
                                            <button
                                                onClick={() => setShowImportHelp(true)}
                                                className="text-green-600 hover:text-green-800 transition-colors"
                                                title="Format attendu ?"
                                            >
                                                <HelpCircle className="w-5 h-5" />
                                            </button>
                                        </div>
                                        <input
                                            type="file"
                                            ref={globalFileInputRef}
                                            onChange={handleGlobalImportCSV}
                                            accept=".csv"
                                            className="hidden"
                                        />
                                    </div>

                                    {/* Teacher Import */}
                                    <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100 flex items-center justify-between">
                                        <div className="flex items-center">
                                            <Briefcase className="w-5 h-5 mr-3 text-indigo-600" />
                                            <div>
                                                <h5 className="font-bold text-indigo-900 text-sm">Enseignants</h5>
                                                <p className="text-xs text-indigo-700">Professeurs et Affectations</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => teacherFileInputRef.current?.click()}
                                                className="text-xs flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors shadow-sm"
                                            >
                                                <FileUp className="w-4 h-4" />
                                                Importer
                                            </button>
                                            <button
                                                onClick={() => setShowImportHelp(true)}
                                                className="text-indigo-600 hover:text-indigo-800 transition-colors"
                                                title="Format attendu ?"
                                            >
                                                <HelpCircle className="w-5 h-5" />
                                            </button>
                                        </div>
                                        <input
                                            type="file"
                                            ref={teacherFileInputRef}
                                            onChange={handleTeacherImportCSV}
                                            accept=".csv"
                                            className="hidden"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Add Class Form */}
                            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                                <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center justify-between">
                                    <div className="flex items-center">
                                        <GraduationCap className="w-4 h-4 mr-2 text-green-600" />
                                        Ajouter une classe manuellement
                                    </div>
                                </h4>



                                <form onSubmit={handleAddClass} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                    <div className="md:col-span-1">
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Code MEF (11 chiffres)</label>
                                        <div className="flex gap-1">
                                            <input
                                                type="text"
                                                value={newClass.mef}
                                                onChange={(e) => setNewClass({ ...newClass, mef: e.target.value })}
                                                placeholder="Ex: 23830033004"
                                                className="w-full text-sm border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                                            />
                                            <button
                                                type="button"
                                                onClick={checkMefCode}
                                                className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 rounded border border-gray-300"
                                                title="Vérifier le code et récupérer le libellé"
                                            >
                                                🔍
                                            </button>
                                        </div>
                                    </div>
                                    <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">
                                                Dénomination officielle
                                                {isManualMode ? <span className="text-orange-600 ml-1">(Saisie manuelle)</span> : <span className="text-gray-400 ml-1">(Non modifiable)</span>}
                                            </label>
                                            <input
                                                type="text"
                                                value={newClass.label}
                                                onChange={(e) => isManualMode && setNewClass({ ...newClass, label: e.target.value })}
                                                disabled={!isManualMode}
                                                readOnly={!isManualMode}
                                                className={`w-full text-sm border-gray-200 rounded-md ${!isManualMode ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white border-orange-300 text-gray-900 focus:ring-orange-500 focus:border-orange-500'}`}
                                                placeholder={isManualMode ? "Saisissez la dénomination..." : "Sera rempli après recherche MEF..."}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">
                                                Diplôme préparé
                                                {isManualMode ? <span className="text-orange-600 ml-1">(Saisie manuelle)</span> : <span className="text-gray-400 ml-1">(Lié au MEF)</span>}
                                            </label>
                                            <input
                                                type="text"
                                                value={newClass.diploma}
                                                onChange={(e) => isManualMode && setNewClass({ ...newClass, diploma: e.target.value })}
                                                disabled={!isManualMode}
                                                readOnly={!isManualMode}
                                                className={`w-full text-sm border-gray-200 rounded-md ${!isManualMode ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white border-orange-300 text-gray-900 focus:ring-orange-500 focus:border-orange-500'}`}
                                                placeholder={isManualMode ? "Saisissez le diplôme..." : "Sera rempli après recherche MEF..."}
                                            />
                                        </div>
                                    </div>
                                    <div className="md:col-span-full">
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Nom d'usage de la classe (Modifiable)</label>
                                        <input
                                            type="text"
                                            value={newClass.name}
                                            onChange={(e) => setNewClass({ ...newClass, name: e.target.value })}
                                            placeholder="Ex: 2nde Bac Pro 1"
                                            className="w-full text-sm border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                                            required
                                        />
                                    </div>
                                    <div className="md:col-span-full border-t border-gray-100 my-2 pt-2">
                                        <p className="text-xs font-bold text-gray-500 uppercase mb-2">Professeur Principal</p>
                                        <div className="grid grid-cols-3 gap-2">
                                            <input
                                                type="text"
                                                placeholder="Nom"
                                                value={newClass.mainTeacher.lastName}
                                                onChange={(e) => setNewClass({ ...newClass, mainTeacher: { ...newClass.mainTeacher, lastName: e.target.value } })}
                                                className="text-xs border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Prénom"
                                                value={newClass.mainTeacher.firstName}
                                                onChange={(e) => setNewClass({ ...newClass, mainTeacher: { ...newClass.mainTeacher, firstName: e.target.value } })}
                                                className="text-xs border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                                            />
                                            <input
                                                type="email"
                                                placeholder="Email"
                                                value={newClass.mainTeacher.email}
                                                onChange={(e) => setNewClass({ ...newClass, mainTeacher: { ...newClass.mainTeacher, email: e.target.value } })}
                                                className="text-xs border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                                            />
                                        </div>
                                    </div>
                                    <div className="md:col-span-full border-t border-gray-100 my-2 pt-2">
                                        <p className="text-xs font-bold text-gray-500 uppercase mb-2">CPE Référent</p>
                                        <div className="grid grid-cols-3 gap-2">
                                            <input
                                                type="text"
                                                placeholder="Nom"
                                                value={newClass.cpe.lastName}
                                                onChange={(e) => setNewClass({ ...newClass, cpe: { ...newClass.cpe, lastName: e.target.value } })}
                                                className="text-xs border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Prénom"
                                                value={newClass.cpe.firstName}
                                                onChange={(e) => setNewClass({ ...newClass, cpe: { ...newClass.cpe, firstName: e.target.value } })}
                                                className="text-xs border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                                            />
                                            <input
                                                type="email"
                                                placeholder="Email"
                                                value={newClass.cpe.email}
                                                onChange={(e) => setNewClass({ ...newClass, cpe: { ...newClass.cpe, email: e.target.value } })}
                                                className="text-xs border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                                            />
                                        </div>
                                    </div>
                                    <button
                                        type="submit"
                                        className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 px-4 rounded-md transition-colors h-[38px] flex items-center justify-center"
                                    >
                                        <UserPlus className="w-4 h-4 mr-2" />
                                        Ajouter
                                    </button>
                                </form>
                            </div>

                            {/* TEST DATA RESTORE BUTTON */}
                            {email === 'pledgeum@gmail.com' && (
                                <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center justify-between">
                                    <div className="flex items-center text-yellow-800">
                                        <Sparkles className="w-5 h-5 mr-3" />
                                        <div>
                                            <p className="text-sm font-bold">Mode Test : Données Manquantes ?</p>
                                            <p className="text-xs">Si vous avez vidé votre cache, restaurez les données de démo.</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            if (confirm("Attention : Cela va écraser toutes les données actuelles de l'établissement (Classes, Profs, Élèves). Continuer ?")) {
                                                restoreTestData();
                                                alert("Données de test restaurées !");
                                            }
                                        }}
                                        className="px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-bold rounded shadow-sm transition-colors"
                                    >
                                        Restaurer Données Test
                                    </button>
                                </div>
                            )}

                            {/* Classes List */}
                            <div>
                                <h4 className="text-sm font-bold text-gray-900 mb-3">Liste des classes ({classes.length})</h4>
                                <div className="grid grid-cols-1 gap-4">
                                    {classes.length === 0 ? (
                                        <div className="col-span-full p-8 text-center bg-white rounded-lg border border-gray-200 text-gray-500 italic">
                                            Aucune classe configurée.
                                        </div>
                                    ) : (
                                        classes.map((cls) => (
                                            <div key={cls.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 relative group transition-all duration-200">
                                                <button
                                                    onClick={() => removeClass(cls.id)}
                                                    className="absolute top-2 right-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                                <div className="flex flex-col lg:flex-row items-center gap-4 mb-2">
                                                    <div className="flex-1 min-w-0 w-full">
                                                        <h5 className="font-bold text-gray-900 text-lg cursor-pointer hover:text-blue-600 flex flex-col" onClick={() => setExpandedClassId(expandedClassId === cls.id ? null : cls.id)}>
                                                            <span className="truncate">{cls.name}</span>
                                                            <div className="flex flex-col mt-0.5">
                                                                {cls.label && (
                                                                    <span className="text-xs font-normal text-gray-500 truncate">
                                                                        {cls.label} <span className="text-gray-400">({cls.mef})</span>
                                                                    </span>
                                                                )}
                                                                {cls.diploma && (
                                                                    <span className="text-xs font-semibold text-blue-700 truncate">
                                                                        <span className="text-gray-400 font-normal">Diplôme :</span> {cls.diploma}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </h5>
                                                    </div>
                                                    <div className="flex-none flex flex-wrap gap-2 justify-end w-full lg:w-auto">
                                                        <button
                                                            onClick={() => setExpandedStudentClassId(expandedStudentClassId === cls.id ? null : cls.id)}
                                                            className="text-xs bg-orange-50 text-orange-700 px-3 py-1.5 rounded-full hover:bg-orange-100 font-medium transition-colors border border-orange-200 w-[230px] flex justify-center items-center"
                                                        >
                                                            {expandedStudentClassId === cls.id ? "Masquer les élèves" : `Gérer les élèves (${cls.studentsList?.length || 0})`}
                                                        </button>
                                                        <button
                                                            onClick={() => setExpandedClassId(expandedClassId === cls.id ? null : cls.id)}
                                                            className="text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full hover:bg-blue-100 font-medium transition-colors border border-blue-200 w-[230px] flex justify-center items-center"
                                                        >
                                                            {expandedClassId === cls.id ? "Masquer l'équipe pédagogique" : `Gérer l'équipe pédagogique (${cls.teachersList?.length || 0})`}
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="space-y-2 mb-4">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Prof. Principal</span>
                                                            {cls.mainTeacher && cls.mainTeacher.lastName ? (
                                                                <div className="text-sm">
                                                                    <p className="font-medium text-gray-900">{cls.mainTeacher.firstName} {cls.mainTeacher.lastName}</p>
                                                                    <p className="text-xs text-gray-500">{cls.mainTeacher.email}</p>
                                                                </div>
                                                            ) : (
                                                                <p className="text-xs text-gray-400 italic">Non assigné</p>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">CPE</span>
                                                            {cls.cpe && cls.cpe.lastName ? (
                                                                <div className="text-sm">
                                                                    <p className="font-medium text-gray-900">{cls.cpe.firstName} {cls.cpe.lastName}</p>
                                                                    <p className="text-xs text-gray-500">{cls.cpe.email}</p>
                                                                </div>
                                                            ) : (
                                                                <p className="text-xs text-gray-400 italic">Non assigné</p>
                                                            )}
                                                        </div>

                                                    </div>
                                                </div>

                                                {/* Teacher Management Section */}
                                                <div className={`border-t border-gray-100 pt-3 ${expandedClassId === cls.id ? 'block' : 'hidden'}`}>

                                                    {/* Responsables de la classe (New) */}
                                                    <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
                                                        <h6 className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-3 flex items-center">
                                                            <Briefcase className="w-3 h-3 mr-2" />
                                                            Responsables de la classe
                                                        </h6>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            {/* Main Teacher Selector */}
                                                            <div>
                                                                <label className="block text-xs font-medium text-gray-700 mb-1">Professeur Principal</label>
                                                                <select
                                                                    className="block w-full text-xs border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                                                    value={
                                                                        cls.teachersList.find(t =>
                                                                            (cls.mainTeacher?.email && t.email === cls.mainTeacher.email) ||
                                                                            (cls.mainTeacher && t.lastName === cls.mainTeacher.lastName && t.firstName === cls.mainTeacher.firstName)
                                                                        )?.id || ""
                                                                    }
                                                                    onChange={(e) => {
                                                                        const selectedId = e.target.value;
                                                                        if (selectedId === "") {
                                                                            updateClass(cls.id, { mainTeacher: undefined });
                                                                        } else {
                                                                            const teacher = cls.teachersList.find(t => t.id === selectedId);
                                                                            if (teacher) {
                                                                                updateClass(cls.id, {
                                                                                    mainTeacher: {
                                                                                        firstName: teacher.firstName,
                                                                                        lastName: teacher.lastName,
                                                                                        email: teacher.email || ""
                                                                                    }
                                                                                });
                                                                            }
                                                                        }
                                                                    }}
                                                                >
                                                                    <option value="">-- Sélectionner --</option>
                                                                    {cls.teachersList.map((t) => (
                                                                        <option key={t.id} value={t.id}>
                                                                            {t.lastName.toUpperCase()} {t.firstName}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                                {cls.teachersList.length === 0 && (
                                                                    <p className="text-[10px] text-orange-600 mt-1 italic">Ajoutez d'abord des enseignants ci-dessous.</p>
                                                                )}
                                                            </div>

                                                            {/* CPE Selector */}
                                                            <div>
                                                                <label className="block text-xs font-medium text-gray-700 mb-1">Conseiller Principal d'Éducation (CPE)</label>
                                                                <select
                                                                    className="block w-full text-xs border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                                                    value={
                                                                        collaborators.find(c =>
                                                                            c.role === 'CPE' && c.email === cls.cpe?.email
                                                                        )?.id || ""
                                                                    }
                                                                    onChange={(e) => {
                                                                        const selectedId = e.target.value;
                                                                        if (selectedId === "") {
                                                                            updateClass(cls.id, { cpe: undefined });
                                                                        } else {
                                                                            const cpe = collaborators.find(c => c.id === selectedId);
                                                                            if (cpe) {
                                                                                // Split name for SchoolStaff format
                                                                                const nameParts = cpe.name.split(' ');
                                                                                const firstName = nameParts[0];
                                                                                const lastName = nameParts.slice(1).join(' ') || firstName;

                                                                                updateClass(cls.id, {
                                                                                    cpe: {
                                                                                        firstName: firstName,
                                                                                        lastName: lastName === firstName ? "" : lastName,
                                                                                        email: cpe.email
                                                                                    }
                                                                                });
                                                                            }
                                                                        }
                                                                    }}
                                                                >
                                                                    <option value="">-- Sélectionner --</option>
                                                                    {collaborators.filter(c => c.role === 'CPE').map((c) => (
                                                                        <option key={c.id} value={c.id}>
                                                                            {c.name}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                                {collaborators.filter(c => c.role === 'CPE').length === 0 && (
                                                                    <p className="text-[10px] text-orange-600 mt-1 italic">Aucun CPE dans "Collaborateurs".</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <h6 className="text-sm font-bold text-gray-900 mb-2 flex items-center justify-between">
                                                        Équipe Pédagogique
                                                        <div className="flex space-x-2">
                                                            {/* Generate Credentials Button */}
                                                            <button
                                                                onClick={async () => {
                                                                    generateTeacherCredentials(cls.id);
                                                                    // Wait for state update (next tick) or assume updated
                                                                    setTimeout(async () => {
                                                                        const updatedClass = classes.find(c => c.id === cls.id);
                                                                        if (updatedClass && updatedClass.teachersList.length > 0) {
                                                                            const blob = await pdf(
                                                                                <TeacherCredentialsPdf
                                                                                    teachers={updatedClass.teachersList}
                                                                                    schoolName={schoolName}
                                                                                    className={updatedClass.name}
                                                                                />
                                                                            ).toBlob();
                                                                            const url = URL.createObjectURL(blob);
                                                                            const a = document.createElement('a');
                                                                            a.href = url;
                                                                            a.download = `Identifiants_Profs_${updatedClass.name}.pdf`; // User requested "Même design" - assumed print functionality too
                                                                            a.click();
                                                                            URL.revokeObjectURL(url);
                                                                        }
                                                                    }, 500);
                                                                }}
                                                                className="text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 px-2 py-1 rounded flex items-center border border-purple-200"
                                                                title="Générer et imprimer les identifiants provisoires"
                                                            >
                                                                <Key className="w-3 h-3 mr-1" /> Identifiants
                                                            </button>

                                                            {/* Test Account Auto-Populate Button */}
                                                            {email === 'pledgeum@gmail.com' && (
                                                                <button
                                                                    onClick={() => handleAutoPopulate(cls.id)}
                                                                    className="text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-2 py-1 rounded flex items-center border border-indigo-200"
                                                                    title="Générer 5 enseignants fictifs (Mode Test)"
                                                                >
                                                                    <Sparkles className="w-3 h-3 mr-1" /> Auto-Test
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => fileInputRef.current?.click()}
                                                                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded flex items-center"
                                                                title="Import CSV (Nom, Prénom, Email)"
                                                            >
                                                                <FileUp className="w-3 h-3 mr-1" /> Import CSV
                                                            </button>
                                                            <button
                                                                onClick={() => alert("Format CSV attendu :\n\nUne ligne d'en-tête est requise avec les colonnes suivantes :\nNom, Prénom, Email\n\nExemple :\nNom,Prénom,Email\nDupont,Marie,marie.dupont@email.com")}
                                                                className="text-gray-400 hover:text-blue-600 transition-colors"
                                                                title="Aide format CSV"
                                                            >
                                                                <HelpCircle className="w-4 h-4" />
                                                            </button>
                                                            <input
                                                                type="file"
                                                                ref={fileInputRef}
                                                                onChange={(e) => handleImportCSV(e, cls.id)}
                                                                className="hidden"
                                                                accept=".csv"
                                                            />
                                                        </div>
                                                    </h6>

                                                    {/* Add Teacher Form */}
                                                    <form onSubmit={(e) => handleAddTeacher(e, cls.id)} className="grid grid-cols-7 gap-2 mb-3">
                                                        <input
                                                            placeholder="Nom"
                                                            value={newTeacher.lastName}
                                                            onChange={e => setNewTeacher({ ...newTeacher, lastName: e.target.value })}
                                                            className="col-span-2 text-xs border border-gray-300 rounded px-2 py-1"
                                                            required
                                                        />
                                                        <input
                                                            placeholder="Prénom"
                                                            value={newTeacher.firstName}
                                                            onChange={e => setNewTeacher({ ...newTeacher, firstName: e.target.value })}
                                                            className="col-span-2 text-xs border border-gray-300 rounded px-2 py-1"
                                                            required
                                                        />
                                                        <input
                                                            placeholder="Email"
                                                            type="email"
                                                            value={newTeacher.email}
                                                            onChange={e => setNewTeacher({ ...newTeacher, email: e.target.value })}
                                                            className="col-span-2 text-xs border border-gray-300 rounded px-2 py-1"
                                                            required
                                                        />
                                                        <button type="submit" className="col-span-1 bg-blue-600 text-white rounded flex items-center justify-center hover:bg-blue-700">
                                                            <UserPlus className="w-3 h-3" />
                                                        </button>
                                                    </form>

                                                    {/* Teachers List */}
                                                    <div className="max-h-40 overflow-y-auto space-y-1">
                                                        {cls.teachersList && cls.teachersList.length > 0 ? (
                                                            cls.teachersList.map(teacher => (
                                                                <div key={teacher.id} className="flex justify-between items-center bg-gray-50 px-2 py-1 rounded text-xs group/teacher">
                                                                    <span className="truncate flex-1">{teacher.firstName} {teacher.lastName}</span>
                                                                    <span className="text-gray-400 truncate flex-1 mx-2">{teacher.email}</span>
                                                                    <button
                                                                        onClick={() => removeTeacherFromClass(cls.id, teacher.id)}
                                                                        className="text-gray-400 hover:text-red-500 opacity-0 group-hover/teacher:opacity-100"
                                                                    >
                                                                        <X className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <p className="text-xs text-center text-gray-400 italic">Aucun enseignant assigné.</p>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Student Management Section */}
                                                <div className={`border-t border-gray-100 pt-3 ${expandedStudentClassId === cls.id ? 'block' : 'hidden'}`}>
                                                    <h6 className="text-sm font-bold text-gray-900 mb-2 flex items-center justify-between">
                                                        Élèves / Étudiants
                                                        <div className="flex space-x-2">
                                                            {/* Test Account Auto-Populate Button */}
                                                            {email === 'pledgeum@gmail.com' && (
                                                                <button
                                                                    onClick={() => handleAutoPopulate(cls.id)}
                                                                    className="text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-2 py-1 rounded flex items-center border border-indigo-200"
                                                                    title="Générer des élèves fictifs (Mode Test)"
                                                                >
                                                                    <Sparkles className="w-3 h-3 mr-1" /> Auto-Test
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => studentFileInputRef.current?.click()}
                                                                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded flex items-center"
                                                                title="Import CSV (Nom, Prénom, Email)"
                                                            >
                                                                <FileUp className="w-3 h-3 mr-1" /> Import CSV
                                                            </button>
                                                            <button
                                                                onClick={() => handleGenerateCredentials(cls.id)}
                                                                className="text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 px-2 py-1 rounded flex items-center border border-purple-200"
                                                                title="Générer et télécharger les identifiants provisoires (PDF)"
                                                            >
                                                                <Lock className="w-3 h-3 mr-1" /> Identifiants PDF
                                                            </button>
                                                            <button
                                                                onClick={() => alert("Format CSV attendu :\n\nUne ligne d'en-tête est requise avec les colonnes suivantes :\nNom, Prénom, Email\n\nExemple :\nNom,Prénom,Email\nDupont,Jean,jean.dupont@email.com")}
                                                                className="text-gray-400 hover:text-blue-600 transition-colors"
                                                                title="Aide format CSV"
                                                            >
                                                                <HelpCircle className="w-4 h-4" />
                                                            </button>
                                                            <input
                                                                type="file"
                                                                ref={studentFileInputRef}
                                                                onChange={(e) => handleImportStudentCSV(e, cls.id)}
                                                                className="hidden"
                                                                accept=".csv"
                                                            />
                                                        </div>
                                                    </h6>

                                                    {/* Add Student Form */}
                                                    <form onSubmit={(e) => handleAddStudent(e, cls.id)} className="grid grid-cols-7 gap-2 mb-3">
                                                        <input
                                                            placeholder="Nom"
                                                            value={newStudent.lastName}
                                                            onChange={e => setNewStudent({ ...newStudent, lastName: e.target.value })}
                                                            className="col-span-2 text-xs border border-gray-300 rounded px-2 py-1"
                                                            required
                                                        />
                                                        <input
                                                            placeholder="Prénom"
                                                            value={newStudent.firstName}
                                                            onChange={e => setNewStudent({ ...newStudent, firstName: e.target.value })}
                                                            className="col-span-2 text-xs border border-gray-300 rounded px-2 py-1"
                                                            required
                                                        />
                                                        <input
                                                            placeholder="Email"
                                                            type="email"
                                                            value={newStudent.email}
                                                            onChange={e => setNewStudent({ ...newStudent, email: e.target.value })}
                                                            className="col-span-2 text-xs border border-gray-300 rounded px-2 py-1"
                                                            required
                                                        />
                                                        <button type="submit" className="col-span-1 bg-orange-600 text-white rounded flex items-center justify-center hover:bg-orange-700">
                                                            <UserPlus className="w-3 h-3" />
                                                        </button>
                                                    </form>

                                                    {/* Students List */}
                                                    <div className="max-h-40 overflow-y-auto space-y-1">
                                                        {cls.studentsList && cls.studentsList.length > 0 ? (
                                                            cls.studentsList.map(student => (
                                                                <div key={student.id} className="flex justify-between items-center bg-gray-50 px-2 py-1 rounded text-xs group/student">
                                                                    <span className="truncate flex-1">{student.firstName} {student.lastName}</span>
                                                                    <span className="text-gray-400 truncate flex-1 mx-2">{student.email}</span>
                                                                    <button
                                                                        onClick={() => removeStudentFromClass(cls.id, student.id)}
                                                                        className="text-gray-400 hover:text-red-500 opacity-0 group-hover/student:opacity-100"
                                                                    >
                                                                        <X className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <p className="text-xs text-center text-gray-400 italic">Aucun élève assigné.</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : activeTab === 'identity' ? (
                        <div className="space-y-6">
                            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                                <h4 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
                                    <Building className="w-5 h-5 mr-2 text-orange-600" />
                                    Fiche Identité Établissement
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'établissement</label>
                                        <input
                                            type="text"
                                            disabled={!canEditIdentity}
                                            value={useSchoolStore.getState().schoolName || ''}
                                            onChange={(e) => useSchoolStore.getState().updateSchoolIdentity({ schoolName: e.target.value })}
                                            className={`w-full rounded-md border-gray-300 shadow-sm sm:text-sm ${!canEditIdentity ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'focus:border-blue-500 focus:ring-blue-500'}`}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Adresse complète</label>
                                        <textarea
                                            rows={2}
                                            disabled={!canEditIdentity}
                                            value={useSchoolStore.getState().schoolAddress || ''}
                                            onChange={(e) => useSchoolStore.getState().updateSchoolIdentity({ schoolAddress: e.target.value })}
                                            className={`w-full rounded-md border-gray-300 shadow-sm sm:text-sm ${!canEditIdentity ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'focus:border-blue-500 focus:ring-blue-500'}`}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                                        <input
                                            type="text"
                                            disabled={!canEditIdentity}
                                            value={useSchoolStore.getState().schoolPhone || ''}
                                            onChange={(e) => useSchoolStore.getState().updateSchoolIdentity({ schoolPhone: e.target.value })}
                                            className={`w-full rounded-md border-gray-300 shadow-sm sm:text-sm ${!canEditIdentity ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'focus:border-blue-500 focus:ring-blue-500'}`}
                                        />
                                    </div>
                                    <div className="hidden md:block"></div>
                                    <div className="md:col-span-2 border-t pt-4">
                                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Chef d'Établissement</span>
                                        {!canEditIdentity && <p className="text-xs text-red-500 mt-1 flex items-center"><Lock className="w-3 h-3 mr-1" /> Modification réservée au Chef d'Établissement ou Délégué.</p>}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Nom & Prénom</label>
                                        <input
                                            type="text"
                                            disabled={!canEditIdentity}
                                            placeholder="Ex: M. le Proviseur"
                                            value={useSchoolStore.getState().schoolHeadName || ''}
                                            onChange={(e) => useSchoolStore.getState().updateSchoolIdentity({ schoolHeadName: e.target.value })}
                                            className={`w-full rounded-md border-gray-300 shadow-sm sm:text-sm ${!canEditIdentity ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'focus:border-blue-500 focus:ring-blue-500'}`}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Email (Validation)</label>
                                        <input
                                            type="email"
                                            disabled={!canEditIdentity}
                                            value={schoolHeadEmail || ''}
                                            onChange={(e) => useSchoolStore.getState().updateSchoolIdentity({ schoolHeadEmail: e.target.value })}
                                            className={`w-full rounded-md border-gray-300 shadow-sm sm:text-sm ${!canEditIdentity ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'focus:border-blue-500 focus:ring-blue-500'}`}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : activeTab === 'partners' ? (
                        <div className="space-y-6">
                            {/* Import & Actions */}
                            <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                                <div>
                                    <h4 className="font-bold text-gray-900">Base de données Partenaires</h4>
                                    <p className="text-xs text-gray-500">Gérez les entreprises d'accueil pour le module de recherche élève.</p>
                                </div>
                                <div className="flex space-x-3">
                                    <div className="relative group">
                                        <button
                                            onClick={() => partnerFileInputRef.current?.click()}
                                            disabled={isPartnerImporting}
                                            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-md transition-colors flex items-center shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isPartnerImporting ? (
                                                <>
                                                    <Loader2 className="animate-spin w-4 h-4 mr-2" />
                                                    Analyse en cours...
                                                </>
                                            ) : (
                                                <>
                                                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                                                    Importer Partenaires (CSV)
                                                </>
                                            )}
                                        </button>
                                        <div className="absolute top-full right-0 mt-2 w-72 p-3 bg-gray-800 text-white text-xs rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                                            <p className="font-bold mb-1">Format attendu (CSV) :</p>
                                            <ul className="list-disc list-inside space-y-1 text-gray-300">
                                                <li>Colonnes : ACTIVITE; METIERS; LIEUSIRET</li>
                                                <li>Séparateur : Point-virgule (;)</li>
                                                <li>Encodage : ISO-8859-1 (Excel) ou UTF-8</li>
                                            </ul>
                                            <p className="mt-2 text-[10px] text-gray-400">Les métiers peuvent être multiples (séparés par virgule).</p>
                                        </div>
                                        <input
                                            type="file"
                                            ref={partnerFileInputRef}
                                            onChange={handlePartnerImportCSV}
                                            accept=".csv"
                                            className="hidden"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Visibility Alert */}
                            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 flex items-start">
                                <AlertTriangle className="w-5 h-5 text-blue-500 mr-2 flex-shrink-0 mt-0.5" />
                                <div className="text-sm text-blue-700">
                                    <p className="font-bold">Configuration de la visibilité</p>
                                    <p>Décochez les éléments (Activités, Filières ou Classes) pour les masquer sur la carte de recherche des élèves. Par défaut, tout est visible.</p>
                                </div>
                            </div>

                            {/* Filters Bar */}
                            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col space-y-3">
                                <div className="flex flex-wrap gap-4 items-center">
                                    <span className="text-sm font-semibold text-gray-700 mr-2 flex items-center">
                                        <Search className="w-4 h-4 mr-2" />
                                        Visibilité :
                                    </span>
                                    <CheckableDropdown
                                        label="Activités"
                                        options={uniqueActivities}
                                        selected={visibleActivities}
                                        onChange={handleActivityChange}
                                    />
                                    <CheckableDropdown
                                        label="Filières"
                                        options={uniqueJobs}
                                        selected={visibleJobs}
                                        onChange={handleJobChange}
                                    />
                                    <CheckableDropdown
                                        label="Classes"
                                        options={uniqueClasses}
                                        selected={visibleClasses}
                                        onChange={handleClassChange}
                                    />
                                </div>
                            </div>

                            {/* Partners List */}
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                    <h5 className="font-bold text-gray-700 flex items-center">
                                        <Building2 className="w-4 h-4 mr-2" />
                                        Liste des Partenaires ({filteredPartners.length} / {partnerCompanies.length})
                                    </h5>
                                </div>
                                {filteredPartners.length === 0 ? (
                                    <div className="p-8 text-center text-gray-500">
                                        {partnerCompanies.length === 0 ? (
                                            <>
                                                <p>Aucune entreprise partenaire enregistrée.</p>
                                                <p className="text-xs mt-1">Utilisez l'import CSV pour peupler la base.</p>
                                            </>
                                        ) : (
                                            <p>Aucun partenaire ne correspond aux filtres sélectionnés.</p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SIRET</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Raison Sociale</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Activité</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ville</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Filières (Métiers)</th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {filteredPartners.map((partner) => (
                                                    <tr key={partner.siret} className="hover:bg-gray-50">
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{partner.siret}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{partner.name}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{partner.activity || '-'}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{partner.city}</td>
                                                        <td className="px-6 py-4 text-sm text-gray-500">
                                                            <div className="flex flex-wrap gap-1">
                                                                {partner.jobs && partner.jobs.map((job, i) => (
                                                                    <span key={i} className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                                        {job}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                            <button
                                                                onClick={() => {
                                                                    if (confirm(`Supprimer ${partner.name} ?`)) {
                                                                        removePartner(partner.siret);
                                                                    }
                                                                }}
                                                                className="text-red-600 hover:text-red-900"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                                <h4 className="text-lg font-bold text-gray-900 mb-2 flex items-center">
                                    <Sparkles className="w-5 h-5 mr-2 text-purple-600" />
                                    Types de Convention Autorisés
                                </h4>
                                <p className="text-sm text-gray-500 mb-6">
                                    Sélectionnez les modèles de convention que les élèves de votre établissement peuvent choisir.
                                    Si un type est décoché, il ne sera plus proposé dans l'assistant de création.
                                </p>

                                <div className="space-y-4">
                                    {[
                                        { id: 'PFMP_STANDARD', label: 'PFMP Lycée Professionnel (Standard)' },
                                        { id: 'STAGE_2NDE', label: 'Stage de Seconde' },
                                        { id: 'ERASMUS_MOBILITY', label: 'Mobilité Erasmus+' },
                                        { id: 'BTS_INTERNSHIP', label: 'Convention de stage BTS' }
                                    ].map((type) => {
                                        const isAllowed = useSchoolStore.getState().allowedConventionTypes?.includes(type.id);
                                        const isDev = type.id === 'STAGE_2NDE' || type.id === 'ERASMUS_MOBILITY' || type.id === 'BTS_INTERNSHIP';

                                        return (
                                            <div
                                                key={type.id}
                                                className={`flex items-center p-4 border rounded-lg transition-colors ${isDev ? 'bg-gray-100 border-gray-200 cursor-not-allowed' : 'hover:bg-gray-50'
                                                    }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    id={type.id}
                                                    checked={isAllowed && !isDev} // Force unchecked if dev, or just respect store but disable? User said "proposer les choix en gris". Usually implies disabled. I'll respect store state but disable interaction. Actually, if it's in dev, it shouldn't be selectable. I'll disable input.
                                                    disabled={isDev}
                                                    onChange={(e) => useSchoolStore.getState().toggleConventionType(type.id, e.target.checked)}
                                                    className={`w-5 h-5 rounded focus:ring-blue-500 border-gray-300 ${isDev ? 'text-gray-400 cursor-not-allowed bg-gray-200' : 'text-blue-600'
                                                        }`}
                                                />
                                                <label
                                                    htmlFor={type.id}
                                                    className={`ml-3 block text-sm font-medium w-full ${isDev ? 'text-gray-400 cursor-not-allowed' : 'text-gray-900 cursor-pointer'
                                                        }`}
                                                >
                                                    {type.label}
                                                    {isDev && <span className="ml-2 text-xs font-normal italic text-gray-400">(En cours de développement)</span>}
                                                </label>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div >
            {showImportHelp && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full flex flex-col p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center">
                                <FileSpreadsheet className="w-5 h-5 mr-2 text-green-600" />
                                Format d'import CSV
                            </h3>
                            <button onClick={() => setShowImportHelp(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="text-sm text-gray-600 space-y-4">
                            <p>
                                Le fichier doit être un <strong>export CSV Pronote</strong> standard (encodage ISO-8859-1 ou UTF-8).
                            </p>
                            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 font-mono text-xs">
                                <p className="font-bold text-gray-700 mb-1">Colonnes obligatoires (séparateur point-virgule ';') :</p>
                                <ul className="list-disc pl-4 space-y-1">
                                    <li>NOM</li>
                                    <li>PRENOM</li>
                                    <li>DATE NAISS <span className="text-gray-400">(JJ/MM/AAAA)</span></li>
                                    <li>CLASSES <span className="text-gray-400">(ex: 2NDE1)</span></li>
                                </ul>
                            </div>
                            <p className="text-xs text-gray-500 italic">
                                * Les doublons sont détectés automatiquement (Nom + Prénom + Date de naissance).
                            </p>
                        </div>
                        <div className="mt-6 flex justify-end">
                            <button
                                onClick={() => setShowImportHelp(false)}
                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
                            >
                                Compris
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {
                importReviewData && (
                    <StructureImportReviewModal
                        isOpen={true}
                        onClose={() => setImportReviewData(null)}
                        data={importReviewData}
                        onConfirm={(selectedData) => {
                            importGlobalStructure(selectedData);
                            setImportReviewData(null);
                            alert(`${selectedData.length} classes traitées avec succès.`);
                        }}
                    />
                )
            }

            {
                teacherImportReviewData && (
                    <TeacherImportReviewModal
                        isOpen={!!teacherImportReviewData}
                        onClose={() => setTeacherImportReviewData(null)}
                        data={teacherImportReviewData}
                        onConfirm={(selectedData) => {
                            importGlobalTeachers(selectedData);
                            setTeacherImportReviewData(null);
                            alert(`${selectedData.length} professeurs importés avec succès.`);
                        }}
                    />
                )
            }


        </div >
    );
}
