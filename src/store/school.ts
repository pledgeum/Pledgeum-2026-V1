import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { db } from '@/lib/firebase';
import { doc, writeBatch, collection, setDoc, query, where, getDocs, deleteDoc, getDoc } from 'firebase/firestore';

export type CollaboratorRole =
    | 'DDFPT'
    | 'BDE' // Bureau des entreprises
    | 'AT_DDFPT'
    | 'CPE'
    | 'VIE_SCOLAIRE'
    | 'ADJOINT_GEST'
    | 'SEC_INTENDANCE';

export const COLLABORATOR_LABELS: Record<CollaboratorRole, string> = {
    'DDFPT': 'DDFPT (Directeur·rice Délégué·e aux Formations)',
    'BDE': 'Responsable Bureau des Entreprises',
    'AT_DDFPT': 'Assistant(e) Technique DDFPT',
    'CPE': 'CPE (Conseiller·ère Principal·e d\'Éducation)',
    'VIE_SCOLAIRE': 'Vie Scolaire',
    'ADJOINT_GEST': 'Adjoint(e) Gestionnaire',
    'SEC_INTENDANCE': 'Secrétaire d\'Intendance'
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
    birthDate?: string; // For duplicate checking
    tempId?: string;
    tempCode?: string;
    credentialsPrinted?: boolean;
    phone?: string;
    address?: Address;

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
    pfmpPeriods: PfmpPeriod[];
}

export interface Teacher {
    id: string;
    firstName: string;
    lastName: string;
    email?: string; // Optional for Pronote import
    birthDate?: string; // For duplicate checking
    preferredCommune?: string;
    coordinates?: { lat: number; lng: number };
    tempId?: string;
    tempCode?: string;
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

    importGlobalTeachers: (structure: { teacher: Omit<Teacher, 'id'>; classes: string[] }[], schoolId?: string) => Promise<void>;
    updateTeacher: (classId: string, teacherId: string, updates: Partial<Teacher>) => void;
    removeTeacherFromClass: (classId: string, teacherId: string) => void;

    importStudents: (classId: string, students: Omit<Student, 'id'>[]) => void;
    addStudentToClass: (classId: string, student: Omit<Student, 'id'>) => void;
    removeStudentFromClass: (classId: string, studentId: string) => void;
    generateStudentCredentials: (classId: string) => void;
    regenerateStudentCredentials: (classId: string, studentId: string) => void;
    markCredentialsPrinted: (classId: string, studentIds: string[]) => void;

    importGlobalStructure: (structure: { className: string; students: Omit<Student, 'id'>[] }[], schoolId?: string) => Promise<void>;
    generateTeacherCredentials: (classId: string, schoolId: string) => Promise<void>;

    schoolName: string;
    schoolAddress: string;
    schoolPhone: string;
    schoolHeadName: string;
    schoolHeadEmail: string;
    updateSchoolIdentity: (data: Partial<{
        schoolName: string;
        schoolAddress: string;
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

    // FETCH METHOD
    fetchSchoolData: (schoolId: string) => Promise<void>;
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

            fetchSchoolData: async (schoolId: string) => {
                if (!schoolId) return;
                const state = get();

                try {
                    console.log(`[SCHOOL_STORE] Fetching data for school: ${schoolId}`);

                    // 1. Fetch Classes (Root Collection 'classes' filtered by schoolId)
                    const classesQ = query(collection(db, "classes"), where("schoolId", "==", schoolId));
                    const classesSnap = await getDocs(classesQ);
                    const loadedClasses: ClassDefinition[] = [];
                    classesSnap.forEach(doc => {
                        loadedClasses.push(doc.data() as ClassDefinition);
                    });

                    // 2. Fetch Users (for Collaborators)
                    const usersQ = query(collection(db, "users"), where("schoolId", "==", schoolId));
                    const usersSnap = await getDocs(usersQ);

                    const collaborators: Collaborator[] = [];
                    usersSnap.forEach(doc => {
                        const userData = doc.data();
                        const role = userData.role;
                        if (['ddfpt', 'business_manager', 'school_head', 'cpe', 'assistant_manager'].includes(role)) {
                            collaborators.push({
                                id: doc.id,
                                name: userData.name || `${userData.profileData?.firstName || ''} ${userData.profileData?.lastName || ''}`,
                                email: userData.email,
                                role: role.toUpperCase() as any
                            });
                        }
                    });

                    // 3. Fetch Partner Companies (Collection 'companies' filtered by schoolId)
                    const companiesQ = query(collection(db, "companies"), where("schoolId", "==", schoolId));
                    const companiesSnap = await getDocs(companiesQ);
                    const loadedPartners: PartnerCompany[] = [];
                    companiesSnap.forEach(doc => {
                        // Ensure we map Firestore document data to PartnerCompany interface
                        // We assume the document contains compatible fields.
                        // We assign the Firestore doc ID as 'siret' if we want to use it as key, 
                        // but usually SIRET is the business key. Ideally we stored with SIRET as ID.
                        const data = doc.data();
                        loadedPartners.push({
                            siret: data.siret || doc.id,
                            name: data.name,
                            address: data.address,
                            city: data.city,
                            postalCode: data.postalCode,
                            activity: data.activity,
                            jobs: data.jobs || [],
                            coordinates: data.coordinates
                        });
                    });

                    // 4. Fetch School Identity (Metadata)
                    const schoolDocRef = doc(db, "schools", schoolId);
                    const schoolDocSnap = await getDoc(schoolDocRef);
                    let identityUpdates = {};

                    if (schoolDocSnap.exists()) {
                        const sData = schoolDocSnap.data();
                        identityUpdates = {
                            schoolName: sData.name || state.schoolName,
                            schoolAddress: sData.address || state.schoolAddress,
                            schoolPhone: sData.phone || state.schoolPhone,
                            schoolHeadName: sData.headName || state.schoolHeadName,
                            schoolHeadEmail: sData.adminEmail || sData.email || state.schoolHeadEmail
                        };
                        console.log(`[SCHOOL_STORE] Loaded School Identity: ${sData.name}`);
                    } else {
                        console.warn(`[SCHOOL_STORE] School document not found for ID: ${schoolId}`);
                    }

                    console.log(`[SCHOOL_STORE] Loaded ${loadedClasses.length} classes, ${collaborators.length} collaborators, and ${loadedPartners.length} partners.`);

                    set((state) => ({
                        classes: loadedClasses.sort((a, b) => a.name.localeCompare(b.name)),
                        collaborators: collaborators.length > 0 ? collaborators : state.collaborators,
                        partnerCompanies: loadedPartners,
                        ...identityUpdates
                    }));

                } catch (e) {
                    console.error("Error fetching school data:", e);
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

            generateTeacherCredentials: async (classId, schoolId) => {
                const state = get();
                const cls = state.classes.find((c) => c.id === classId);
                if (!cls) return;

                const batch = writeBatch(db);
                let hasUpdates = false;

                const updatedTeachers = cls.teachersList.map((teacher) => {
                    const clean = (str: string) => str.toUpperCase()
                        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                        .replace(/[^A-Z0-9]/g, "");

                    const sLast = clean(teacher.lastName).substring(0, 4).padEnd(4, 'X');
                    const sFirst = clean(teacher.firstName).substring(0, 4).padEnd(4, 'X');

                    let tempId = teacher.tempId;
                    let isNew = false;

                    if (!tempId) {
                        const random3 = Math.floor(100 + Math.random() * 900);
                        tempId = `${sLast}${sFirst}${random3}`;
                        isNew = true;
                    }

                    const tempCode = teacher.tempCode || Math.floor(100000 + Math.random() * 900000).toString();
                    if (!teacher.tempCode) isNew = true;

                    // PERSIST TO FIRESTORE (Idempotent: Overwrite if ID matches, but we keep same ID if exists)
                    // We only write if we generated something new OR if we want to ensure sync (safer to sync all)
                    if (tempId && tempCode && schoolId) {
                        const invRef = doc(collection(db, 'invitations'), tempId);
                        batch.set(invRef, {
                            tempId,
                            tempCode,
                            email: teacher.email || '',
                            role: 'teacher',
                            schoolId: schoolId,
                            classId: classId,
                            className: cls.name,
                            name: `${teacher.firstName} ${teacher.lastName}`,
                            createdAt: new Date().toISOString()
                        }, { merge: true }); // Merge to avoid destroying if exists (though tempId should be unique-ish)
                        hasUpdates = true;
                    }

                    return { ...teacher, tempId, tempCode };
                });

                if (hasUpdates) {
                    try {
                        await batch.commit();
                        console.log("Teacher credentials persisted to Firestore.");
                    } catch (e) {
                        console.error("Failed to persist teacher credentials:", e);
                        alert("Erreur lors de la sauvegarde des identifiants (Bdd). Ils fonctionneront en local seulement.");
                    }
                }

                set((state) => ({
                    classes: state.classes.map((c) => {
                        if (c.id !== classId) return c;
                        return { ...c, teachersList: updatedTeachers };
                    })
                }));
            },



            // Default: Lycée Ferdinand Buisson
            schoolName: "Lycée Polyvalent Ferdinand Buisson",
            schoolAddress: "6 rue Auguste Houzeau, 76504 Elbeuf",
            schoolPhone: "02 32 96 48 00",
            schoolHeadName: "M. le Proviseur",
            schoolHeadEmail: "pledgeum@gmail.com",

            delegatedAdminId: null,

            allowedConventionTypes: ['PFMP_STANDARD', 'STAGE_2NDE', 'ERASMUS_MOBILITY'],

            updateSchoolIdentity: (data) => set((state) => ({ ...state, ...data })),
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

            removeCollaborator: (id) => set((state) => ({
                collaborators: state.collaborators.filter((c) => c.id !== id)
            })),

            addClass: (cls) => set((state) => ({
                classes: [...state.classes, { ...cls, id: Math.random().toString(36).substr(2, 9), teachersList: [], studentsList: [] }]
            })),

            removeClass: (id) => set((state) => ({
                classes: state.classes.filter((c) => c.id !== id)
            })),

            updateClass: (id, updates) => set((state) => ({
                classes: state.classes.map((c) => c.id === id ? { ...c, ...updates } : c)
            })),

            addPfmpPeriod: (periodData) => set((state) => ({
                classes: state.classes.map((c) => {
                    if (c.id !== periodData.classId) return c;
                    return {
                        ...c,
                        pfmpPeriods: [...(c.pfmpPeriods || []), createPfmpPeriod(periodData)]
                    };
                })
            })),

            updatePfmpPeriod: (periodId, updates) => set((state) => ({
                classes: state.classes.map((c) => ({
                    ...c,
                    pfmpPeriods: (c.pfmpPeriods || []).map(p =>
                        p.id === periodId ? { ...p, ...updates } : p
                    )
                }))
            })),

            deletePfmpPeriod: (periodId) => set((state) => ({
                classes: state.classes.map((c) => ({
                    ...c,
                    pfmpPeriods: (c.pfmpPeriods || []).filter(p => p.id !== periodId)
                }))
            })),

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

            importGlobalTeachers: async (structure: { teacher: Omit<Teacher, 'id'>; classes: string[] }[], schoolId?: string) => {
                const state = get();
                let currentClasses = [...state.classes];

                structure.forEach((item) => {
                    const { teacher, classes: teacherClasses } = item;

                    teacherClasses.forEach((className) => {
                        // 1. Find or Create Class
                        let targetClassIndex = currentClasses.findIndex(c => c.name.trim().toLowerCase() === className.trim().toLowerCase());

                        if (targetClassIndex === -1) {
                            // Create new class
                            const newClass: ClassDefinition = {
                                id: Math.random().toString(36).substr(2, 9),
                                name: className,
                                teachersList: [],
                                studentsList: [],
                                pfmpPeriods: []
                            };
                            currentClasses.push(newClass);
                            targetClassIndex = currentClasses.length - 1;
                        }

                        // 2. Add Teacher to Class
                        const targetClass = currentClasses[targetClassIndex];
                        const existingTeachers = targetClass.teachersList;

                        const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

                        const isDuplicate = existingTeachers.some(existing => {
                            const sameLast = normalize(existing.lastName) === normalize(teacher.lastName);
                            const sameFirst = normalize(existing.firstName) === normalize(teacher.firstName);
                            const sameDob = (existing.birthDate && teacher.birthDate)
                                ? existing.birthDate === teacher.birthDate
                                : true; // Conservative match if DOB is missing
                            // Also check email if available as a secondary check
                            const sameEmail = (existing.email && teacher.email)
                                ? existing.email.toLowerCase() === teacher.email.toLowerCase()
                                : false;

                            return (sameLast && sameFirst && sameDob) || sameEmail;
                        });

                        if (!isDuplicate) {
                            currentClasses[targetClassIndex] = {
                                ...targetClass,
                                teachersList: [...targetClass.teachersList, { ...teacher, id: Math.random().toString(36).substr(2, 9) }]
                            };
                        }
                    });
                });

                // --- FIRESTORE PERSISTENCE ---
                if (schoolId) {
                    try {
                        await setDoc(doc(db, 'schools', schoolId), {
                            classes: currentClasses,
                            updatedAt: new Date().toISOString()
                        }, { merge: true });
                        console.log("School teachers persisted to Firestore.");
                    } catch (e) {
                        console.error("Failed to persist teachers:", e);
                    }
                }

                set({ classes: currentClasses });
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

            importGlobalStructure: async (structure: { className: string; students: Omit<Student, 'id'>[] }[], schoolId?: string) => {
                const state = get();
                let currentClasses = [...state.classes];

                structure.forEach((group) => {
                    // 1. Find or Create Class
                    // Try to match by Exact Name first, strictly.
                    let targetClassIndex = currentClasses.findIndex(c => c.name.trim().toLowerCase() === group.className.trim().toLowerCase());

                    let isNewClass = false;
                    if (targetClassIndex === -1) {
                        // Create new class
                        const newClass: ClassDefinition = {
                            id: Math.random().toString(36).substr(2, 9),
                            name: group.className,
                            teachersList: [],
                            studentsList: [],
                            pfmpPeriods: []
                        };
                        currentClasses.push(newClass);
                        targetClassIndex = currentClasses.length - 1;
                        isNewClass = true;
                    }

                    // 2. Process Students
                    const targetClass = currentClasses[targetClassIndex];
                    const updatedStudentsList = [...targetClass.studentsList];
                    const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

                    group.students.forEach((importedStudent) => {
                        // Duplicate Check Strategy: Name + First Name
                        const existingIndex = updatedStudentsList.findIndex(existing => {
                            const sameLast = normalize(existing.lastName) === normalize(importedStudent.lastName);
                            const sameFirst = normalize(existing.firstName) === normalize(importedStudent.firstName);
                            return sameLast && sameFirst;
                        });

                        if (existingIndex >= 0) {
                            // Update existing student with new info (e.g. birthDate)
                            updatedStudentsList[existingIndex] = {
                                ...updatedStudentsList[existingIndex],
                                ...importedStudent,
                                id: updatedStudentsList[existingIndex].id,
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

                    // Update the class with new/updated students
                    currentClasses[targetClassIndex] = {
                        ...targetClass,
                        studentsList: updatedStudentsList
                    };
                });

                // --- FIRESTORE PERSISTENCE ---
                if (schoolId) {
                    try {
                        // We persist the ENTIRE classes array to Firestore for simplicity 
                        // (Schema: schools/{schoolId} -> classes: ClassDefinition[])
                        // OR individual sync?
                        // Given the structure, full replace of the 'classes' field is safest for consistency for now,
                        // assuming we are the only writer.

                        await setDoc(doc(db, 'schools', schoolId), {
                            classes: currentClasses,
                            updatedAt: new Date().toISOString()
                        }, { merge: true });
                        console.log("School structure persisted to Firestore.");
                    } catch (e) {
                        console.error("Failed to persist structure:", e);
                    }
                }

                set({ classes: currentClasses });
            },

            partnerCompanies: [],

            importPartners: async (newPartners: PartnerCompany[], schoolId?: string) => {
                const state = get();
                const existing = state.partnerCompanies || [];
                const existingSirets = new Set(existing.map(p => p.siret));
                const toAdd = newPartners.filter(p => !existingSirets.has(p.siret));
                const updatedPartners = [...existing, ...toAdd];

                // --- FIRESTORE PERSISTENCE ---
                if (schoolId) {
                    try {
                        const batch = writeBatch(db);

                        toAdd.forEach(partner => {
                            // Use siret as doc key or generate ID if missing? Siret is usually unique.
                            // If siret is missing, we should probably generate an ID.
                            // Assuming siret is present as per interface.
                            const docId = partner.siret ? partner.siret : Math.random().toString(36).substr(2, 9);
                            const partnerRef = doc(db, 'companies', docId);
                            batch.set(partnerRef, {
                                ...partner,
                                schoolId,
                                updatedAt: new Date().toISOString()
                            }, { merge: true });
                        });

                        await batch.commit();
                        console.log("Partner companies persisted to Firestore 'companies' collection.");
                    } catch (e) {
                        console.error("Failed to persist partners:", e);
                    }
                }

                set({ partnerCompanies: updatedPartners });
            },

            removePartner: async (siret) => {
                const state = get();
                // 1. Local Update
                set({
                    partnerCompanies: (state.partnerCompanies || []).filter(p => p.siret !== siret)
                });

                // 2. Firestore Delete
                // Ideally we need schoolId to verify ownership or just rely on Siret if used as ID.
                // Since this is a simple delete by ID, we assume Siret = Doc ID as per import logic.
                try {
                    await deleteDoc(doc(db, 'companies', siret));
                    console.log(`[SCHOOL_STORE] Partner ${siret} deleted from Firestore.`);
                } catch (e) {
                    console.error("Failed to delete partner from Firestore:", e);
                }
            },

            hiddenActivities: [],
            setHiddenActivities: (activities) => set({ hiddenActivities: activities }),

            hiddenJobs: [],
            setHiddenJobs: (jobs) => set({ hiddenJobs: jobs }),

            hiddenClasses: [],
            setHiddenClasses: (classes) => set({ hiddenClasses: classes }),

            restoreTestData: async (schoolId?: string) => {
                const testClasses: ClassDefinition[] = [
                    {
                        id: 'test-class-mef',
                        name: 'T.ASSP 1',
                        mainTeacher: { firstName: 'Jean', lastName: 'Dupont', email: 'jean.dupont@ecole.fr' },
                        cpe: { firstName: 'Marie', lastName: 'Durand', email: 'marie.durand@ecole.fr' },
                        mef: '23830033004',
                        label: 'TLE PRO3 ACC.SOINS-S.PERS. OPT.EN STRUCTUR',
                        diploma: 'BAC PRO EN 3 ANS : TERMINALE PRO',
                        teachersList: [
                            { id: 't1', firstName: 'Jean', lastName: 'Dupont', email: 'jean.dupont@ecole.fr' },
                            { id: 't2', firstName: 'Alice', lastName: 'Martin', email: 'alice.martin@ecole.fr' },
                            { id: 't3', firstName: 'Bob', lastName: 'Dubois', email: 'bob.dubois@ecole.fr' }
                        ],
                        studentsList: [
                            { id: 's1', firstName: 'Lucas', lastName: 'Bernard', email: 'lucas.bernard@etu.fr', birthDate: '2006-05-15' },
                            { id: 's2', firstName: 'Emma', lastName: 'Petit', email: 'emma.petit@etu.fr', birthDate: '2006-08-22' },
                            { id: 's3', firstName: 'Louis', lastName: 'Robert', email: 'louis.robert@etu.fr', birthDate: '2006-02-10' },
                            { id: 's4', firstName: 'Chloé', lastName: 'Richard', email: 'chloe.richard@etu.fr', birthDate: '2006-11-05' }
                        ],
                        pfmpPeriods: []
                    },
                    {
                        id: 'test-class-2',
                        name: '1ERE AGORA',
                        mainTeacher: { firstName: 'Sophie', lastName: 'Leroy', email: 'sophie.leroy@ecole.fr' },
                        cpe: { firstName: 'Marie', lastName: 'Durand', email: 'marie.durand@ecole.fr' },
                        mef: '22830023002',
                        label: '1ERE PRO GESTION-ADMINISTRATION',
                        diploma: 'BAC PRO EN 3 ANS : PREMIERE PRO',
                        teachersList: [
                            { id: 't4', firstName: 'Sophie', lastName: 'Leroy', email: 'sophie.leroy@ecole.fr' },
                            { id: 't5', firstName: 'Marc', lastName: 'Moreau', email: 'marc.moreau@ecole.fr' }
                        ],
                        studentsList: [
                            { id: 's5', firstName: 'Thomas', lastName: 'Simon', email: 'thomas.simon@etu.fr', birthDate: '2007-03-30' },
                            { id: 's6', firstName: 'Léa', lastName: 'Michel', email: 'lea.michel@etu.fr', birthDate: '2007-07-12' }
                        ],
                        pfmpPeriods: []
                    },
                    {
                        id: 'demo-class-2nde1',
                        name: '2NDE 1',
                        mainTeacher: { firstName: 'Professeur', lastName: 'Démo', email: 'demo@pledgeum.fr' },
                        cpe: { firstName: 'Marie', lastName: 'Durand', email: 'marie.durand@ecole.fr' },
                        mef: '22830023003', // Fictitious but consistent
                        label: 'SECONDE PRO METIERS DU PILOTAGE',
                        diploma: 'BAC PRO MSPC',
                        teachersList: [
                            { id: 't_demo', firstName: 'Professeur', lastName: 'Démo', email: 'demo@pledgeum.fr' }
                        ],
                        studentsList: [
                            { id: 's_demo', firstName: 'Élève', lastName: 'Démo', email: 'demo@pledgeum.fr', birthDate: '2005-06-15' }
                        ],
                        pfmpPeriods: []
                    }
                ];

                const testCollaborators: Collaborator[] = [
                    { id: 'c1', name: 'Marie Durand', email: 'marie.durand@ecole.fr', role: 'CPE' },
                    { id: 'c2', name: 'Paul Lefebvre', email: 'paul.lefebvre@ecole.fr', role: 'DDFPT' }
                ];

                const newState = {
                    classes: testClasses,
                    collaborators: testCollaborators,
                    schoolName: "Lycée d'Excellence Démo",
                    schoolAddress: "1 Avenue de la République, 75001 Paris",
                    schoolPhone: "01 23 45 67 89",
                    schoolHeadName: "M. le Proviseur Démo",
                    schoolHeadEmail: "demo@pledgeum.fr"
                };

                if (schoolId) {
                    try {
                        const batch = writeBatch(db);

                        // 1. Persist Classes
                        testClasses.forEach(cls => {
                            const classRef = doc(db, 'classes', cls.id);
                            batch.set(classRef, { ...cls, schoolId, updatedAt: new Date().toISOString() }, { merge: true });
                        });

                        // 2. Persist Collaborators (As Users for Persistence)
                        testCollaborators.forEach(collab => {
                            // Use email as key or a reliable ID?
                            // Sandbox IDs are fixed in the array (c1, c2).
                            // We will use c1, c2 as Doc ID for simplicity in Sandbox.
                            const userRef = doc(db, 'users', collab.id);
                            batch.set(userRef, {
                                uid: collab.id,
                                email: collab.email,
                                role: collab.role.toLowerCase(), // Store role in lowercase as per User model usually
                                schoolId: schoolId,
                                profileData: {
                                    firstName: collab.name.split(' ')[0],
                                    lastName: collab.name.split(' ')[1] || '',
                                },
                                createdAt: new Date().toISOString()
                            }, { merge: true });
                        });

                        // 3. Persist School Doc
                        const schoolRef = doc(db, 'schools', schoolId);
                        batch.set(schoolRef, {
                            ...newState,
                            updatedAt: new Date().toISOString()
                        }, { merge: true });

                        await batch.commit();
                        console.log(`[SCHOOL_STORE] Sandbox data persisted for school: ${schoolId}`);

                    } catch (e) {
                        console.error("[SCHOOL_STORE] Failed to persist sandbox data:", e);
                    }
                }

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
