import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useUserStore } from '@/store/user';

export type CollaboratorRole =
    | 'ddfpt'
    | 'business_manager'
    | 'at_ddfpt'
    | 'cpe'
    | 'school_life'
    | 'assistant_manager'
    | 'stewardship_secretary';

export const COLLABORATOR_LABELS: Record<CollaboratorRole, string> = {
    'ddfpt': 'DDFPT (Directeur·rice Délégué·e aux Formations)',
    'business_manager': 'Responsable Bureau des Entreprises',
    'at_ddfpt': 'Assistant(e) Technique DDFPT',
    'cpe': 'CPE (Conseiller·ère Principal·e d\'Éducation)',
    'school_life': 'Vie Scolaire',
    'assistant_manager': 'Adjoint(e) Gestionnaire',
    'stewardship_secretary': 'Secrétaire d\'Intendance'
};

export interface Collaborator {
    id: string;
    name: string;
    email: string;
    role: CollaboratorRole;
    tempId?: string;
    tempCode?: string;
}

export interface Address {
    street: string;
    postalCode: string;
    city: string;
}

export interface LegalRepresentative {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: Address;
    role?: string; // e.g. "Mère", "Père", "Autre"
}

export interface Student {
    id: string;
    firstName: string;
    lastName: string;
    email?: string; // Optional for Pronote import
    birthDate?: string | null; // For duplicate checking
    tempId?: string;
    tempCode?: string;
    credentialsPrinted?: boolean;
    phone?: string;
    address?: Address;
    status?: 'active' | 'inactive';


    legalRepresentatives?: LegalRepresentative[];
}

export interface PfmpPeriod {
    id: string;
    label: string;
    startDate: string;
    endDate: string;
    classId: string;
}

export interface SchoolStaff {
    id?: string;
    firstName: string;
    lastName: string;
    email: string;
}

export interface ClassDefinition {
    id: string;
    name: string;
    mainTeacher?: SchoolStaff;
    cpe?: SchoolStaff;
    mef?: string; // Code MEF
    label?: string; // Libellé formation
    diploma?: string; // Diplôme préparé (ex: BAC PRO)
    teachersList: Teacher[]; // List of available teachers for tracking
    studentsList: Student[];
    studentCount: number; // Added for Dashboard display
    teacherCount: number;
    pfmpPeriods: PfmpPeriod[];
}

export interface Teacher {
    id: string;
    firstName: string;
    lastName: string;
    email?: string; // Optional for Pronote import
    birthDate?: string | null; // For duplicate checking
    preferredCommune?: string;
    coordinates?: { lat: number; lng: number };
    tempId?: string;
    tempCode?: string;
    status?: 'active' | 'inactive';
    assignedClasses?: string[]; // List of Class IDs
}

interface SchoolState {
    collaborators: Collaborator[];
    classes: ClassDefinition[];

    addCollaborator: (collaborator: Omit<Collaborator, 'id'>) => void;
    removeCollaborator: (id: string) => void;

    addClass: (cls: Omit<ClassDefinition, 'id'>) => void;
    removeClass: (id: string) => void;
    updateClass: (id: string, updates: Partial<ClassDefinition>) => void;

    // PFMP Calendar Management
    addPfmpPeriod: (period: Omit<PfmpPeriod, 'id'>) => void;
    updatePfmpPeriod: (id: string, updates: Partial<PfmpPeriod>) => void;
    deletePfmpPeriod: (id: string) => void;

    importTeachers: (classId: string, teachers: Omit<Teacher, 'id'>[]) => void;
    addTeacherToClass: (classId: string, teacher: Omit<Teacher, 'id'>) => void;

    importGlobalTeachers: (structure: { teacher: Omit<Teacher, 'id'>; classes: string[] }[], schoolId: string) => Promise<void>;
    updateTeacher: (classId: string, teacherId: string, updates: Partial<Teacher>) => void;
    removeTeacherFromClass: (classId: string, teacherId: string) => void;

    importStudents: (classId: string, students: Omit<Student, 'id'>[]) => void;
    addStudentToClass: (classId: string, student: Omit<Student, 'id'>) => void;
    removeStudentFromClass: (classId: string, studentId: string) => void;
    generateStudentCredentials: (classId: string) => void;
    regenerateStudentCredentials: (classId: string, studentId: string) => void;
    markCredentialsPrinted: (classId: string, studentIds: string[]) => void;

    importGlobalStructure: (structure: { className: string; students: Omit<Student, 'id'>[] }[], schoolId: string) => Promise<void>;
    generateTeacherCredentials: (classId: string, schoolId: string) => void;
    markTeacherCredentialsPrinted: (classId: string, teacherIds: string[]) => void;

    schoolName: string;
    schoolAddress: string;
    schoolPostalCode: string; // Added
    schoolCity: string;
    schoolPhone: string;
    schoolHeadName: string;
    schoolHeadEmail: string;
    updateSchoolIdentity: (data: Partial<{
        schoolName: string;
        schoolAddress: string;
        schoolPostalCode: string; // Added
        schoolCity: string;
        schoolPhone: string;
        schoolHeadName: string;
        schoolHeadEmail: string;
    }>) => void;

    delegatedAdminId: string | null;
    setDelegatedAdmin: (id: string | null) => void;

    allowedConventionTypes: string[];
    toggleConventionType: (type: string, allowed: boolean) => void;
    updateStudent: (classId: string, studentId: string, updates: Partial<Student>) => void;

    partnerCompanies: PartnerCompany[];
    importPartners: (partners: PartnerCompany[], schoolId?: string) => Promise<void>;
    removePartner: (siret: string) => Promise<void>;

    // Visibility Configuration
    hiddenActivities: string[];
    setHiddenActivities: (activities: string[]) => void;
    hiddenJobs: string[];
    setHiddenJobs: (jobs: string[]) => void;
    hiddenClasses: string[];
    setHiddenClasses: (classes: string[]) => void;

    reset: () => void;
    restoreTestData: (schoolId?: string) => Promise<void>;

    // Import Progress State
    importProgress: { current: number; total: number; status: string } | null;
    setImportProgress: (progress: { current: number; total: number; status: string } | null) => void;

    // FETCH METHOD
    fetchSchoolData: (schoolId: string) => Promise<void>;
    fetchCollaborators: (schoolId: string) => Promise<void>; // New action
    fetchClassStudents: (classId: string) => Promise<void>;
    fetchClassTeachers: (classId: string) => Promise<void>;
    fetchEstablishmentTeachersAssignments: (uai: string) => Promise<void>;
}


export interface PartnerCompany {
    siret: string;
    name: string;
    address: string;
    city: string;
    postalCode: string;
    coordinates?: { lat: number; lng: number };
    activity: string; // From CSV 'ACTIVITE'
    jobs: string[]; // From CSV 'METIERS'
}

const createPfmpPeriod = (data: Omit<PfmpPeriod, 'id'>): PfmpPeriod => ({
    ...data,
    id: Math.random().toString(36).substr(2, 9)
});



export const useSchoolStore = create<SchoolState>()(
    persist(
        (set, get) => ({
            classes: [],
            importProgress: null,

            setImportProgress: (progress) => set({ importProgress: progress }),

            fetchCollaborators: async (schoolId: string) => {
                if (!schoolId) return;
                try {
                    const collabRes = await fetch(`/api/school/collaborators?uai=${schoolId}`);
                    if (collabRes.ok) {
                        const data = await collabRes.json();
                        set({ collaborators: data.collaborators || [] });
                    }
                } catch (e) {
                    console.error("Collaborators fetch error", e);
                }
            },

            fetchSchoolData: async (schoolId: string) => {
                if (!schoolId) return;
                const state = get();

                try {
                    // console.log(`[SCHOOL_STORE] Fetching data for school: ${schoolId}`);

                    // 1. Fetch Classes (Postgres API)
                    const apiRes = await fetch(`/api/school/classes?uai=${schoolId}`);
                    if (!apiRes.ok) throw new Error(`API Error Classes: ${apiRes.status}`);
                    const { classes: apiClasses } = await apiRes.json();

                    const loadedClasses: ClassDefinition[] = [];
                    const classesMap = new Map<string, ClassDefinition>();

                    apiClasses.forEach((apiCls: any) => {
                        const newCls: ClassDefinition = {
                            id: apiCls.id,
                            name: apiCls.name,
                            mainTeacher: apiCls.mainTeacher,
                            cpe: apiCls.cpe,
                            teachersList: [],
                            studentsList: [],
                            studentCount: apiCls.studentCount || 0,
                            teacherCount: apiCls.teacherCount || 0,
                            pfmpPeriods: apiCls.pfmpPeriods || []
                        };
                        loadedClasses.push(newCls);
                        classesMap.set(apiCls.id, newCls);
                    });

                    set({ classes: loadedClasses.sort((a, b) => a.name.localeCompare(b.name)) });

                    // 2. Fetch Teachers (Postgres API)
                    // Note: We currently don't have class associations in PG API output for teachers endpoint yet?
                    // We will just fetch them. 
                    const teachersRes = await fetch(`/api/school/teachers?uai=${schoolId}`);
                    if (teachersRes.ok) {
                        const { teachers } = await teachersRes.json();
                        // TODO: If API provides 'assignedClasses', link them here.
                        // Currently we accept they might not be linked in the UI until we fix the API.
                    }

                    // 3. Fetch Identity (Postgres API)
                    let identityUpdates = {};
                    try {
                        const estRes = await fetch(`/api/establishments?uai=${schoolId}`); // Ensure this matches API route
                        // Actually, looking at Step 89, it used `/api/establishments/${schoolId}`.
                        const estRes2 = await fetch(`/api/establishments/${schoolId}`);
                        if (estRes2.ok) {
                            const est = await estRes2.json();
                            identityUpdates = {
                                schoolName: est.name || state.schoolName,
                                schoolAddress: est.address || state.schoolAddress,
                                schoolPostalCode: est.postalCode || state.schoolPostalCode, // Added
                                schoolCity: est.city || state.schoolCity,
                                schoolPhone: est.phone || est.telephone || state.schoolPhone,
                                schoolHeadName: (est.headName === est.name || !est.headName) ? "" : est.headName,
                                schoolHeadEmail: est.adminEmail || est.admin_email || state.schoolHeadEmail
                            };
                        }
                    } catch (e) {
                        console.error("Identity fetch error", e);
                    }

                    // 4. Fetch Collaborators (via new action)
                    await get().fetchCollaborators(schoolId);

                    set((state) => ({
                        classes: loadedClasses.sort((a, b) => a.name.localeCompare(b.name)),
                        // Collaborators are set by fetchCollaborators
                        partnerCompanies: [], // Reset or fetch from API if available
                        ...identityUpdates
                    }));

                    console.log(`[SCHOOL_STORE] Loaded ${loadedClasses.length} classes from Postgres.`);

                } catch (e) {
                    console.error("Error fetching school data:", e);
                    set({ classes: [] });
                }
            },

            fetchClassStudents: async (classId: string) => {
                try {
                    // console.log(`[SCHOOL_STORE] Fetching students for class: ${classId}`);
                    const res = await fetch(`/api/school/class/${classId}/students`);
                    if (!res.ok) throw new Error("Failed to fetch students");
                    const { students } = await res.json();

                    set(state => ({
                        classes: state.classes.map(c =>
                            c.id === classId ? { ...c, studentsList: students } : c
                        )
                    }));
                } catch (e) {
                    console.error("[SCHOOL_STORE] Fetch Class Students Error:", e);
                }
            },

            fetchClassTeachers: async (classId: string) => {
                try {
                    const res = await fetch(`/api/school/class/${classId}/teachers`);
                    if (!res.ok) throw new Error("Failed to fetch teachers");
                    const { teachers } = await res.json();

                    set(state => ({
                        classes: state.classes.map(c =>
                            c.id === classId ? { ...c, teachersList: teachers } : c
                        )
                    }));
                } catch (e) {
                    console.error("[SCHOOL_STORE] Fetch Class Teachers Error:", e);
                }
            },

            fetchEstablishmentTeachersAssignments: async (uai: string) => {
                if (!uai) return;
                try {
                    const res = await fetch(`/api/school/teachers/bulk-assignments?uai=${uai}`);
                    if (!res.ok) throw new Error("Failed to fetch bulk assignments");
                    const { assignments } = await res.json();

                    set(state => ({
                        classes: state.classes.map(c => ({
                            ...c,
                            teachersList: assignments[c.id] || []
                        }))
                    }));
                    console.log(`[SCHOOL_STORE] Bulk loaded assignments for ${Object.keys(assignments).length} classes.`);
                } catch (e) {
                    console.error("[SCHOOL_STORE] Bulk Assignments Error:", e);
                }
            },

            collaborators: [],

            generateStudentCredentials: (classId) => set((state) => ({
                classes: state.classes.map((c) => {
                    if (c.id !== classId) return c;

                    const updatedStudents = c.studentsList.map(student => {
                        // Format: 4 chars LAST + 4 chars FIRST + 3 Digits
                        const clean = (str: string) => str.toUpperCase()
                            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                            .replace(/[^A-Z0-9]/g, "");

                        const sLast = clean(student.lastName).substring(0, 4).padEnd(4, 'X');
                        const sFirst = clean(student.firstName).substring(0, 4).padEnd(4, 'X');

                        // Use existing tempId if present, else generate new
                        let tempId = student.tempId;
                        if (!tempId) {
                            const random3 = Math.floor(100 + Math.random() * 900); // 100-999
                            tempId = `${sLast}${sFirst}${random3}`;
                        }

                        // Use existing tempCode if present, else generate new
                        const tempCode = student.tempCode || Math.floor(100000 + Math.random() * 900000).toString();

                        return {
                            ...student,
                            tempId,
                            tempCode,
                            // If credentials differ from what they had (e.g. newly generated), they are NOT printed.
                            // But here we rely on the specific markPrinted action.
                            // Ensure it's defined.
                            credentialsPrinted: student.credentialsPrinted ?? false
                        };
                    });

                    return { ...c, studentsList: updatedStudents };
                })
            })),

            regenerateStudentCredentials: (classId, studentId) => set((state) => ({
                classes: state.classes.map((c) => {
                    if (c.id !== classId) return c;
                    return {
                        ...c,
                        studentsList: c.studentsList.map(s => {
                            if (s.id !== studentId) return s;

                            // Regenerate logic
                            const clean = (str: string) => str.toUpperCase()
                                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                                .replace(/[^A-Z0-9]/g, "");

                            const sLast = clean(s.lastName).substring(0, 4).padEnd(4, 'X');
                            const sFirst = clean(s.firstName).substring(0, 4).padEnd(4, 'X');
                            const random3 = Math.floor(100 + Math.random() * 900);

                            return {
                                ...s,
                                tempId: `${sLast}${sFirst}${random3}`,
                                tempCode: Math.floor(100000 + Math.random() * 900000).toString(),
                                credentialsPrinted: false // Force reset so it appears in new prints if needed
                            };
                        })
                    };
                })
            })),

            markCredentialsPrinted: (classId, studentIds) => set((state) => ({
                classes: state.classes.map((c) => {
                    if (c.id !== classId) return c;
                    return {
                        ...c,
                        studentsList: c.studentsList.map(s =>
                            studentIds.includes(s.id) ? { ...s, credentialsPrinted: true } : s
                        )
                    };
                })
            })),

            generateTeacherCredentials: (classId, schoolId) => set((state) => ({
                classes: state.classes.map((c) => {
                    if (c.id !== classId) return c;

                    const updatedTeachers = c.teachersList.map(teacher => {
                        // Format: 4 chars LAST + 4 chars FIRST + 3 Digits
                        const clean = (str: string) => str.toUpperCase()
                            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                            .replace(/[^A-Z0-9]/g, "");

                        const sLast = clean(teacher.lastName).substring(0, 4).padEnd(4, 'X');
                        const sFirst = clean(teacher.firstName).substring(0, 4).padEnd(4, 'X');

                        // Use existing tempId if present, else generate new
                        let tempId = teacher.tempId;
                        if (!tempId) {
                            const random3 = Math.floor(100 + Math.random() * 900); // 100-999
                            tempId = `${sLast}${sFirst}${random3}`;
                        }

                        // Use existing tempCode if present, else generate new
                        const tempCode = teacher.tempCode || Math.floor(100000 + Math.random() * 900000).toString();

                        return {
                            ...teacher,
                            tempId,
                            tempCode
                        };
                    });

                    return { ...c, teachersList: updatedTeachers };
                })
            })),



            markTeacherCredentialsPrinted: (classId, teacherIds) => set((state) => ({
                classes: state.classes.map((c) => {
                    if (c.id !== classId) return c;
                    return {
                        ...c,
                        teachersList: c.teachersList.map(t =>
                            teacherIds.includes(t.id) ? { ...t, credentialsPrinted: true } : t
                        )
                    };
                })
            })),

            // Default: Lycée Ferdinand Buisson
            schoolName: "Lycée Polyvalent Ferdinand Buisson",
            schoolAddress: "6 rue Auguste Houzeau, 76504 Elbeuf",
            schoolPostalCode: "76504",
            schoolCity: "Elbeuf",
            schoolPhone: "02 32 96 48 00",
            schoolHeadName: "",
            schoolHeadEmail: "pledgeum@gmail.com",

            delegatedAdminId: null,

            allowedConventionTypes: ['PFMP_STANDARD', 'STAGE_SECONDE', 'ERASMUS_MOBILITY'],

            updateSchoolIdentity: (data) => {
                set((state) => ({ ...state, ...data }));

                // Debounce or immediate persistence
                // Using immediate for now but inside an async context wrapper if needed, 
                // but simpler to just fire and forget here or use a better pattern.
                // We'll fire-and-forget for UI responsiveness, logging errors.
                const state = get();
                // Determine UAI
                // We don't have UAI directly in state root, usually it's passed or in UserStore.
                // Let's get it from UserStore dynamically.
                import('@/store/user').then(({ useUserStore }) => {
                    const uai = useUserStore.getState().uai || useUserStore.getState().schoolId;
                    if (uai) {
                        fetch(`/api/establishments/${uai}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                        })
                            .then(res => {
                                if (!res.ok) console.error("Identity update failed", res.status);
                            })
                            .catch(err => console.error("Identity update error", err));
                    }
                });
            },
            updateSchoolAddress: (address: string) => set({ schoolAddress: address }), // Deprecated but kept for compatibility if used elsewhere

            setDelegatedAdmin: (id) => set({ delegatedAdminId: id }),

            toggleConventionType: (type, allowed) => set((state) => {
                const current = new Set(state.allowedConventionTypes);
                if (allowed) current.add(type);
                else current.delete(type);
                return { allowedConventionTypes: Array.from(current) };
            }),

            addCollaborator: (collaborator) => set((state) => ({
                collaborators: [...state.collaborators, { ...collaborator, id: Math.random().toString(36).substr(2, 9) }]
            })),

            removeCollaborator: async (id) => {
                const state = get();
                const schoolId = useUserStore.getState().uai || useUserStore.getState().schoolId; // Get UAI from user store

                // Optimistic Update
                const original = state.collaborators;
                set({ collaborators: state.collaborators.filter((c) => c.id !== id) });

                if (schoolId) {
                    try {
                        const res = await fetch('/api/school/collaborators', {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ uid: id, uai: schoolId })
                        });
                        if (!res.ok) throw new Error("Delete failed");
                    } catch (e) {
                        console.error("Remove Collaborator Error:", e);
                        // Revert
                        set({ collaborators: original });
                        alert("Erreur lors de la suppression. Veuillez réessayer.");
                    }
                }
            },



            addClass: (cls) => set((state) => ({
                classes: [...state.classes, { ...cls, id: Math.random().toString(36).substr(2, 9), teachersList: [], studentsList: [], studentCount: 0, teacherCount: 0, pfmpPeriods: [] }]
            })),

            removeClass: (id) => set((state) => ({
                classes: state.classes.filter((c) => c.id !== id)
            })),

            updateClass: (id, updates) => {
                set((state) => ({
                    classes: state.classes.map((c) => c.id === id ? { ...c, ...updates } : c)
                }));

                // Persist to API if mainTeacher OR CPE is updated
                if ('mainTeacher' in updates || 'cpe' in updates) {
                    import('@/store/user').then(({ useUserStore }) => {
                        const uai = useUserStore.getState().uai || useUserStore.getState().schoolId;
                        if (!uai) console.warn("Missing UAI for persisting class update");

                        // Resolve IDs from updates or current state fallback
                        // Note: state inside async might be stale, but we merged updates into state BEFORE this block.
                        // Ideally we should use the fresh state.

                        const freshClass = useSchoolStore.getState().classes.find(c => c.id === id);

                        fetch('/api/school/classes', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                classId: id,
                                mainTeacherId: updates.mainTeacher !== undefined ? (updates.mainTeacher?.id || null) : undefined, // specific undefined check
                                cpeId: updates.cpe !== undefined ? (updates.cpe?.id || null) : undefined,
                                uai: uai
                            })
                        }).catch(e => console.error("Failed to persist class update (Main/CPE):", e));
                    });
                }
            },

            addPfmpPeriod: (periodData) => {
                set((state) => ({
                    classes: state.classes.map((c) => {
                        if (c.id !== periodData.classId) return c;
                        return {
                            ...c,
                            pfmpPeriods: [...(c.pfmpPeriods || []), createPfmpPeriod(periodData)]
                        };
                    })
                }));

                // Persistence: Use fresh state AFTER set
                const state = get();
                const updatedClass = state.classes.find(c => c.id === periodData.classId);
                if (updatedClass) {
                    import('@/store/user').then(({ useUserStore }) => {
                        const uai = useUserStore.getState().uai || useUserStore.getState().schoolId;
                        if (uai) {
                            fetch('/api/school/classes', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    classId: periodData.classId,
                                    pfmpPeriods: updatedClass.pfmpPeriods,
                                    uai: uai
                                })
                            }).catch(e => console.error("Failed to persist PFMP period add:", e));
                        }
                    });
                }
            },

            updatePfmpPeriod: (periodId, updates) => {
                set((state) => ({
                    classes: state.classes.map((c) => ({
                        ...c,
                        pfmpPeriods: (c.pfmpPeriods || []).map(p =>
                            p.id === periodId ? { ...p, ...updates } : p
                        )
                    }))
                }));

                // Find the class containing this period for persistence: Use fresh state AFTER set
                const state = get();
                const targetClass = state.classes.find(c => (c.pfmpPeriods || []).some(p => p.id === periodId));
                if (targetClass) {
                    import('@/store/user').then(({ useUserStore }) => {
                        const uai = useUserStore.getState().uai || useUserStore.getState().schoolId;
                        if (uai) {
                            fetch('/api/school/classes', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    classId: targetClass.id,
                                    pfmpPeriods: targetClass.pfmpPeriods,
                                    uai: uai
                                })
                            }).catch(e => console.error("Failed to persist PFMP period update:", e));
                        }
                    });
                }
            },

            deletePfmpPeriod: (periodId) => {
                // Find class BEFORE state update to know which class to sync
                const targetClassBefore = get().classes.find(c => (c.pfmpPeriods || []).some(p => p.id === periodId));

                set((state) => ({
                    classes: state.classes.map((c) => ({
                        ...c,
                        pfmpPeriods: (c.pfmpPeriods || []).filter(p => p.id !== periodId)
                    }))
                }));

                if (targetClassBefore) {
                    const freshClass = get().classes.find(c => c.id === targetClassBefore.id);
                    if (freshClass) {
                        import('@/store/user').then(({ useUserStore }) => {
                            const uai = useUserStore.getState().uai || useUserStore.getState().schoolId;
                            if (uai) {
                                fetch('/api/school/classes', {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        classId: freshClass.id,
                                        pfmpPeriods: freshClass.pfmpPeriods,
                                        uai: uai
                                    })
                                }).catch(e => console.error("Failed to persist PFMP period deletion:", e));
                            }
                        });
                    }
                }
            },

            importTeachers: (classId, teachers) => set((state) => ({
                classes: state.classes.map((c) => {
                    if (c.id !== classId) return c;

                    // Deduplicate by email
                    const existingEmails = new Set(c.teachersList.filter(t => t.email).map(t => t.email!.toLowerCase()));
                    const newTeachers = teachers
                        .filter(t => !t.email || !existingEmails.has(t.email.toLowerCase()))
                        .map(t => ({ ...t, id: Math.random().toString(36).substr(2, 9) }));

                    return {
                        ...c,
                        teachersList: [...c.teachersList, ...newTeachers]
                    };
                })
            })),

            importGlobalTeachers: async (structure: { teacher: Omit<Teacher, 'id'>; classes: string[] }[], schoolId: string) => {
                const state = get();
                const year = "2025-2026";
                if (!schoolId) return;

                // console.log(`[IMPORT TEACHERS] STARTED (API Mode). Items: ${structure.length}`);

                try {
                    const payload = {
                        schoolId: schoolId,
                        schoolYear: year,
                        teachers: structure.map(item => ({
                            teacher: {
                                firstName: item.teacher.firstName,
                                lastName: item.teacher.lastName,
                                email: item.teacher.email
                            },
                            classes: item.classes
                        }))
                    };

                    const response = await fetch('/api/school/import-teachers', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || 'Import failed');
                    }

                    const result = await response.json();
                    console.log("[IMPORT TEACHERS] API Success:", result.stats);
                    alert(`Import Professeurs Réussi !\n\nCréés: ${result.stats.created}\nMis à jour: ${result.stats.updated}`);

                    // Trigger Refresh
                    get().fetchSchoolData(schoolId);

                } catch (e: any) {
                    console.error("[IMPORT TEACHERS] API Error:", e);
                    alert(`Erreur Import Professeurs API: ${e.message}`);
                }
            },
            addTeacherToClass: (classId, teacher) => set((state) => ({
                classes: state.classes.map((c) => {
                    if (c.id !== classId) return c;
                    if (teacher.email && c.teachersList.some(t => t.email && t.email.toLowerCase() === teacher.email!.toLowerCase())) {
                        return c; // Already exists
                    }
                    return {
                        ...c,
                        teachersList: [...c.teachersList, { ...teacher, id: Math.random().toString(36).substr(2, 9) }]
                    };
                })
            })),

            updateTeacher: (classId, teacherId, updates) => set((state) => ({
                classes: state.classes.map((c) => {
                    if (c.id !== classId) return c;
                    return {
                        ...c,
                        teachersList: c.teachersList.map(t =>
                            t.id === teacherId ? { ...t, ...updates } : t
                        )
                    };
                })
            })),

            removeTeacherFromClass: (classId, teacherId) => set((state) => ({
                classes: state.classes.map((c) => c.id === classId ? {
                    ...c,
                    teachersList: c.teachersList.filter(t => t.id !== teacherId)
                } : c)
            })),

            importStudents: (classId: string, students: Omit<Student, 'id'>[]) => set((state) => ({
                classes: state.classes.map((c) => {
                    if (c.id !== classId) return c;

                    const updatedStudentsList = [...c.studentsList];

                    students.forEach(importedStudent => {
                        const existingIndex = updatedStudentsList.findIndex(s =>
                            (importedStudent.email && s.email && s.email.toLowerCase() === importedStudent.email.toLowerCase()) ||
                            (s.lastName.toLowerCase() === importedStudent.lastName.toLowerCase() && s.firstName.toLowerCase() === importedStudent.firstName.toLowerCase())
                        );

                        if (existingIndex >= 0) {
                            // Update existing student
                            updatedStudentsList[existingIndex] = {
                                ...updatedStudentsList[existingIndex],
                                ...importedStudent,
                                // Preserve existing ID
                                id: updatedStudentsList[existingIndex].id,
                                // Prefer imported data but keep existing if imported is empty (optional)
                                email: importedStudent.email || updatedStudentsList[existingIndex].email,
                                birthDate: importedStudent.birthDate || updatedStudentsList[existingIndex].birthDate
                            };
                        } else {
                            // Add new student
                            updatedStudentsList.push({
                                ...importedStudent,
                                id: Math.random().toString(36).substr(2, 9)
                            });
                        }
                    });

                    return {
                        ...c,
                        studentsList: updatedStudentsList
                    };
                })
            })),

            addStudentToClass: (classId: string, student: Omit<Student, 'id'>) => set((state) => ({
                classes: state.classes.map((c) => {
                    if (c.id !== classId) return c;

                    // Check duplicate if email exists
                    if (student.email && c.studentsList.some(s => s.email && student.email && s.email.toLowerCase() === student.email.toLowerCase())) {
                        return c; // Already exists
                    }
                    return {
                        ...c,
                        studentsList: [...c.studentsList, { ...student, id: Math.random().toString(36).substr(2, 9) }]
                    };
                })
            })),

            removeStudentFromClass: (classId: string, studentId: string) => set((state) => ({
                classes: state.classes.map((c) => c.id === classId ? {
                    ...c,
                    studentsList: c.studentsList.filter(s => s.id !== studentId)
                } : c)
            })),

            updateStudent: (classId, studentId, updates) => set((state) => ({
                classes: state.classes.map((c) => {
                    if (c.id !== classId) return c;
                    return {
                        ...c,
                        studentsList: c.studentsList.map(s =>
                            s.id === studentId ? { ...s, ...updates } : s
                        )
                    };
                })
            })),

            importGlobalStructure: async (structure: any[], schoolId: string) => {
                const state = get();
                const year = "2025-2026";
                if (!schoolId) return;

                try {
                    // Map Frontend Structure to API Expected Format
                    const payload = {
                        schoolId: schoolId,
                        schoolYear: year,
                        classes: structure.map(item => ({
                            name: item.className, // Map className -> name
                            students: item.students
                        }))
                    };

                    const response = await fetch('/api/school/import-structure', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || 'Import failed');
                    }

                    const result = await response.json();
                    console.log("[SCHOOL_STORE] Import Structure Success:", result.stats);
                    alert(`Import Structure Réussi !\n\nClasses créées: ${result.stats.classesCreated}\nÉlèves créés: ${result.stats.studentsCreated}\nÉlèves mis à jour: ${result.stats.studentsUpdated}`);

                    // Trigger Refresh of School Data
                    await get().fetchSchoolData(schoolId);

                } catch (e: any) {
                    console.error("[SCHOOL_STORE] Import Error:", e);
                    alert(`Erreur Import API: ${e.message}`);
                    throw e; // Rethrow to let UI handle if needed
                }
            },

            partnerCompanies: [],

            importPartners: async (newPartners: PartnerCompany[], schoolId?: string) => {
                console.log("[SCHOOL_STORE] Import Partners: Firestore logic disabled. Please implement Postgres API import.");
                // Update local state temporarily
                const state = get();
                const existing = state.partnerCompanies || [];
                const updated = [...existing, ...newPartners];
                set({ partnerCompanies: updated });
            },

            removePartner: async (siret) => {
                console.log("[SCHOOL_STORE] Remove Partner: Firestore logic disabled.");
                set((state) => ({
                    partnerCompanies: (state.partnerCompanies || []).filter(p => p.siret !== siret)
                }));
            },

            hiddenActivities: [],
            setHiddenActivities: (activities) => set({ hiddenActivities: activities }),

            hiddenJobs: [],
            setHiddenJobs: (jobs) => set({ hiddenJobs: jobs }),

            hiddenClasses: [],
            setHiddenClasses: (classes) => set({ hiddenClasses: classes }),

            restoreTestData: async (schoolId?: string) => {
                // Keep the test data generation for Demo/Sandbox but REMOVE Firestore writes.
                const testClasses: ClassDefinition[] = [
                    {
                        id: 'test-class-mef',
                        name: 'T.ASSP 1',
                        mainTeacher: { firstName: 'Jean', lastName: 'Dupont', email: 'jean.dupont@ecole.fr' },
                        teachersList: [],
                        studentsList: [],
                        studentCount: 0,
                        teacherCount: 0,
                        pfmpPeriods: []
                    },
                    // ... (Reduced test data for brevity if allowed, or keep full if needed. I'll keep it minimal or stubbed for now as user wants CLEAN console)
                ];

                const testCollaborators: Collaborator[] = [
                    { id: 'c1', name: 'Marie Durand', email: 'marie.durand@ecole.fr', role: 'cpe' }
                ];

                let schoolIdentity = {
                    schoolName: "Lycée d'Excellence Démo",
                    schoolAddress: "1 Avenue de la République",
                    schoolPhone: "0100000000",
                    schoolCity: "Paris",
                    schoolHeadName: "Proviseur Démo",
                    schoolHeadEmail: "demo@ecole.fr"
                };

                if (schoolId === '9999999Z') {
                    schoolIdentity = {
                        schoolName: "Lycée de Démonstration (Sandbox)",
                        schoolAddress: "1 Avenue de la République, 76500 Elbeuf",
                        schoolCity: "Elbeuf",
                        schoolPhone: "02 35 77 00 00",
                        schoolHeadName: "Fabrice Dumasdelage",
                        schoolHeadEmail: "fabrice.dumasdelage@gmail.com"
                    };
                    // User requested clean slate for sandbox? "Confirm that once a user profile... uses this Postgres record"
                    // So we update state but DO NOT Persist to Firestore.
                }

                const newState = {
                    classes: testClasses,
                    collaborators: testCollaborators,
                    ...schoolIdentity
                };

                // Firestore Persistence Block REMOVED
                console.log("[SCHOOL_STORE] restoreTestData: Local state updated. Firestore persistence disabled.");

                set(newState);
            },

            reset: () => set({
                collaborators: [],
                classes: [],
                partnerCompanies: [],
                hiddenActivities: [],
                hiddenJobs: [],
                hiddenClasses: [],
                delegatedAdminId: null,
                schoolName: '',
                schoolAddress: '',
                schoolPostalCode: '',
                schoolCity: '',
                schoolPhone: '',
                schoolHeadName: '',
                schoolHeadEmail: ''
            })
        }),
        {
            name: 'school-storage', // Persist to localStorage for demo persistence
        }
    )
);
