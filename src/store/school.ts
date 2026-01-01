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

export interface Student {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
}

export interface ClassDefinition {
    id: string;
    name: string;
    mainTeachers: string; // Comma separated names or just free text for now as per prompt "indiquer le nom"
    cpes: string; // Comma separated names
    teachersList: Teacher[]; // List of available teachers for tracking
    studentsList: Student[];
}

export interface Teacher {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
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
    removeTeacherFromClass: (classId: string, teacherId: string) => void;

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
}

export const useSchoolStore = create<SchoolState>()(
    persist(
        (set) => ({
            collaborators: [],
            classes: [],

            // Default: Lycée Ferdinand Buisson
            schoolName: "Lycée Polyvalent Ferdinand Buisson",
            schoolAddress: "6 rue Auguste Houzeau, 76504 Elbeuf",
            schoolPhone: "02 32 96 48 00",
            schoolHeadName: "", // To be filled by the Head
            schoolHeadEmail: "",

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
                    const existingEmails = new Set(c.teachersList.map(t => t.email.toLowerCase()));
                    const newTeachers = teachers
                        .filter(t => !existingEmails.has(t.email.toLowerCase()))
                        .map(t => ({ ...t, id: Math.random().toString(36).substr(2, 9) }));

                    return {
                        ...c,
                        teachersList: [...c.teachersList, ...newTeachers]
                    };
                })
            })),

            addTeacherToClass: (classId, teacher) => set((state) => ({
                classes: state.classes.map((c) => {
                    if (c.id !== classId) return c;
                    if (c.teachersList.some(t => t.email.toLowerCase() === teacher.email.toLowerCase())) {
                        return c; // Already exists
                    }
                    return {
                        ...c,
                        teachersList: [...c.teachersList, { ...teacher, id: Math.random().toString(36).substr(2, 9) }]
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

                    // Deduplicate by email
                    const existingEmails = new Set(c.studentsList.map(s => s.email.toLowerCase()));
                    const newStudents = students
                        .filter(s => !existingEmails.has(s.email.toLowerCase()))
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
                    if (c.studentsList.some(s => s.email.toLowerCase() === student.email.toLowerCase())) {
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
        }),
        {
            name: 'school-storage', // Persist to localStorage for demo persistence
        }
    )
);
