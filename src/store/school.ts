import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
    phone?: string;
    address?: Address;
    legalRepresentatives?: LegalRepresentative[];
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

    importTeachers: (classId: string, teachers: Omit<Teacher, 'id'>[]) => void;
    addTeacherToClass: (classId: string, teacher: Omit<Teacher, 'id'>) => void;

    importGlobalTeachers: (structure: { teacher: Omit<Teacher, 'id'>; classes: string[] }[]) => void;
    updateTeacher: (classId: string, teacherId: string, updates: Partial<Teacher>) => void;
    removeTeacherFromClass: (classId: string, teacherId: string) => void;

    importStudents: (classId: string, students: Omit<Student, 'id'>[]) => void;
    addStudentToClass: (classId: string, student: Omit<Student, 'id'>) => void;
    removeStudentFromClass: (classId: string, studentId: string) => void;
    generateStudentCredentials: (classId: string) => void;
    generateTeacherCredentials: (classId: string) => void;

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
    importPartners: (partners: PartnerCompany[]) => void;
    removePartner: (siret: string) => void;

    // Visibility Configuration
    hiddenActivities: string[];
    setHiddenActivities: (activities: string[]) => void;
    hiddenJobs: string[];
    setHiddenJobs: (jobs: string[]) => void;
    hiddenClasses: string[];
    setHiddenClasses: (classes: string[]) => void;

    restoreTestData: () => void;
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

export const useSchoolStore = create<SchoolState>()(
    persist(
        (set) => ({
            collaborators: [],

            generateStudentCredentials: (classId) => set((state) => ({
                classes: state.classes.map((c) => {
                    if (c.id !== classId) return c;

                    const updatedStudents = c.studentsList.map(student => {
                        // Skip if already has credentials? OR Regenerate? 
                        // User request: "generate ... for each student". Implies generation. 
                        // Let's preserve if exists, but ensure all have them.

                        // Format: 4 chars LAST + 4 chars FIRST + 3 Digits
                        // Sanitize: Uppercase, remove accents, remove non-alphanumeric
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
                            tempCode
                        };
                    });

                    return { ...c, studentsList: updatedStudents };
                })
            })),

            generateTeacherCredentials: (classId) => set((state) => ({
                classes: state.classes.map((c) => {
                    if (c.id !== classId) return c;

                    const updatedTeachers = c.teachersList.map(teacher => {
                        const clean = (str: string) => str.toUpperCase()
                            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                            .replace(/[^A-Z0-9]/g, "");

                        const sLast = clean(teacher.lastName).substring(0, 4).padEnd(4, 'X');
                        const sFirst = clean(teacher.firstName).substring(0, 4).padEnd(4, 'X');

                        let tempId = teacher.tempId;
                        if (!tempId) {
                            const random3 = Math.floor(100 + Math.random() * 900);
                            tempId = `${sLast}${sFirst}${random3}`;
                        }

                        const tempCode = teacher.tempCode || Math.floor(100000 + Math.random() * 900000).toString();

                        return { ...teacher, tempId, tempCode };
                    });
                    return { ...c, teachersList: updatedTeachers };
                })
            })),

            classes: [
                {
                    id: 'test-class-mef',
                    name: 'T.ASSP 1',
                    mainTeacher: { firstName: 'Jean', lastName: 'Dupont', email: 'jean.dupont@ecole.fr' },
                    cpe: { firstName: 'Marie', lastName: 'Durand', email: 'marie.durand@ecole.fr' },
                    mef: '23830033004',
                    label: 'TLE PRO3 ACC.SOINS-S.PERS. OPT.EN STRUCTUR',
                    diploma: 'BAC PRO EN 3 ANS : TERMINALE PRO',
                    teachersList: [],
                    studentsList: []
                }
            ],

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

            importGlobalTeachers: (structure: { teacher: Omit<Teacher, 'id'>; classes: string[] }[]) => set((state) => {
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
                                studentsList: []
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

                return { classes: currentClasses };
            }),
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

                    // Deduplicate by email only if email is present
                    const existingEmails = new Set(c.studentsList.filter(s => s.email).map(s => s.email!.toLowerCase()));
                    const newStudents = students
                        .filter(s => !s.email || !existingEmails.has(s.email.toLowerCase()))
                        .map(s => ({ ...s, id: Math.random().toString(36).substr(2, 9) }));

                    return {
                        ...c,
                        studentsList: [...c.studentsList, ...newStudents]
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

            importGlobalStructure: (structure: { className: string; students: Omit<Student, 'id'>[] }[]) => set((state) => {
                let currentClasses = [...state.classes];

                structure.forEach((group) => {
                    // 1. Find or Create Class
                    // Try to match by Exact Name first, strictly.
                    let targetClassIndex = currentClasses.findIndex(c => c.name.trim().toLowerCase() === group.className.trim().toLowerCase());

                    if (targetClassIndex === -1) {
                        // Create new class
                        const newClass: ClassDefinition = {
                            id: Math.random().toString(36).substr(2, 9),
                            name: group.className,
                            teachersList: [],
                            studentsList: []
                        };
                        currentClasses.push(newClass);
                        targetClassIndex = currentClasses.length - 1;
                    }

                    // 2. Process Students
                    const targetClass = currentClasses[targetClassIndex];
                    const existingStudents = targetClass.studentsList;

                    const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

                    const newStudentsToAdd: Student[] = [];

                    group.students.forEach((importedStudent) => {
                        // Duplicate Check Strategy:
                        // Check Name + First Name
                        // AND (BirthDate matches OR BirthDate is missing in check)

                        const isDuplicate = existingStudents.some(existing => {
                            const sameLast = normalize(existing.lastName) === normalize(importedStudent.lastName);
                            const sameFirst = normalize(existing.firstName) === normalize(importedStudent.firstName);
                            // If DOB exists for both, check it. If not, rely on names (risky but standard fallback).
                            const sameDob = (existing.birthDate && importedStudent.birthDate)
                                ? existing.birthDate === importedStudent.birthDate
                                : true; // If DOB missing, assume match if names match (conservative)

                            return sameLast && sameFirst && sameDob;
                        });

                        if (!isDuplicate) {
                            newStudentsToAdd.push({
                                ...importedStudent,
                                id: Math.random().toString(36).substr(2, 9)
                            });
                        }
                    });

                    // Update the class with new students
                    currentClasses[targetClassIndex] = {
                        ...targetClass,
                        studentsList: [...targetClass.studentsList, ...newStudentsToAdd]
                    };
                });

                return { classes: currentClasses };

            }),

            partnerCompanies: [],

            importPartners: (newPartners) => set((state) => {
                const existing = state.partnerCompanies || [];
                const existingSirets = new Set(existing.map(p => p.siret));
                const toAdd = newPartners.filter(p => !existingSirets.has(p.siret));
                return { partnerCompanies: [...existing, ...toAdd] };
            }),

            removePartner: (siret) => set((state) => ({
                partnerCompanies: (state.partnerCompanies || []).filter(p => p.siret !== siret)
            })),

            hiddenActivities: [],
            setHiddenActivities: (activities) => set({ hiddenActivities: activities }),

            hiddenJobs: [],
            setHiddenJobs: (jobs) => set({ hiddenJobs: jobs }),

            hiddenClasses: [],
            setHiddenClasses: (classes) => set({ hiddenClasses: classes }),

            restoreTestData: () => set((state) => ({
                classes: [
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
                        ]
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
                        ]
                    }
                ],
                collaborators: [
                    { id: 'c1', name: 'Marie Durand', email: 'marie.durand@ecole.fr', role: 'CPE' },
                    { id: 'c2', name: 'Paul Lefebvre', email: 'paul.lefebvre@ecole.fr', role: 'DDFPT' }
                ],
                schoolName: "Lycée Polyvalent Ferdinand Buisson",
                schoolAddress: "6 rue Auguste Houzeau, 76504 Elbeuf",
                schoolPhone: "02 32 96 48 00",
                schoolHeadName: "M. le Proviseur",
                schoolHeadEmail: "pledgeum@gmail.com"
            })),

        }),
        {
            name: 'school-storage', // Persist to localStorage for demo persistence
        }
    )
);
