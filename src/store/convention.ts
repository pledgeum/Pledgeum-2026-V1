
import { create } from 'zustand';
import { ConventionData } from '@/types/schema';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, setDoc, arrayUnion } from 'firebase/firestore';
import { sendNotification } from '@/lib/notification';
import { generateVerificationUrl } from '@/app/actions/sign';
import { sha256 } from 'js-sha256';
import { UserRole, useUserStore } from './user';
import { useDemoStore } from './demo';

export type ConventionStatus =
    | 'DRAFT'
    | 'SUBMITTED' // En attente validation Enseignant
    | 'VALIDATED_TEACHER' // En attente signature Parents (si mineur) ou Entreprise
    | 'SIGNED_PARENT' // En attente signature Entreprise
    | 'SIGNED_COMPANY' // En attente signature Tuteur
    | 'SIGNED_TUTOR' // En attente signature Chef Établissement
    | 'VALIDATED_HEAD' // Terminée
    | 'REJECTED'; // Demande de correction

export interface Absence {
    id: string;
    date: string;
    type: 'absence' | 'retard';
    duration: number; // in hours
    reason?: string;
    reportedBy: string; // email of reporter
    reportedAt: string;
}

export interface AuditLog {
    date: string;
    action: 'CREATED' | 'OTP_SENT' | 'OTP_VALIDATED' | 'SIGNED' | 'ATTESTATION_SIGNED';
    actorEmail: string;
    details: string;
    ip?: string;
}

export interface Convention extends ConventionData {
    auditLogs?: AuditLog[];
    certificateHash?: string;
    attestationHash?: string;
    id: string;
    userId: string; // ID of the user who created the convention
    studentId: string; // link to user email or ID
    status: ConventionStatus;
    createdAt: string;
    updatedAt: string;
    lastReminderAt?: string; // Timestamp of the last reminder sent

    // New Fields
    absences?: Absence[];
    attestationSigned?: boolean;
    attestationDate?: string;
    attestation_competences?: string;
    attestation_gratification?: string;
    attestation_fait_a?: string;
    attestation_total_jours?: number;
    attestation_signature_img?: string;
    attestation_signature_code?: string;
    attestation_signer_name?: string;
    attestation_signer_function?: string;
    activites?: string; // For attestation override
    competences?: string; // For attestation override
    cpe_email?: string;
    derogationJustification?: string;

    signatures: {
        teacherAt?: string;
        teacherImg?: string;
        teacherCode?: string;
        studentAt?: string;
        studentImg?: string;
        studentCode?: string;
        parentAt?: string;
        parentImg?: string;
        parentCode?: string;
        companyAt?: string;
        companyImg?: string;
        companyCode?: string;
        tutorAt?: string;
        tutorImg?: string;
        tutorCode?: string;
        headAt?: string;
        headImg?: string;
        headCode?: string;
    };
    feedbacks: {
        author: string;
        message: string;
        date: string;
    }[];
    invalidEmails?: string[]; // List of roles with invalid emails
}

interface ConventionState {
    conventions: Convention[];
    addConvention: (data: ConventionData, studentId: string) => void;
    updateStatus: (id: string, newStatus: ConventionStatus) => void;
    signConvention: (id: string, role: string, signatureImage?: string, code?: string, extraAuditLog?: AuditLog, dualSign?: boolean) => Promise<void>;
    addFeedback: (id: string, author: string, message: string) => void;
    assignTrackingTeacher: (conventionId: string, trackingTeacherEmail: string) => Promise<void>;
    getConventionsByRole: (role: string, userEmail: string, currentUserId?: string) => Convention[];
    submitConvention: (data: ConventionData, studentId: string, userId: string) => Promise<void>;
    fetchConventions: (userId: string, userEmail?: string) => Promise<void>;
    fetchAllConventions: () => Promise<Convention[]>;
    updateConvention: (id: string, data: Partial<ConventionData | Convention>) => Promise<void>;
    sendReminder: (id: string) => Promise<void>;
    bulkSignConventions: (ids: string[], role: string, signatureImage?: string) => Promise<void>;
    reportAbsence: (conventionId: string, absence: Omit<Absence, 'id' | 'reportedAt'>) => Promise<void>;
    validateAttestation: (conventionId: string, finalAbsences: number, signatureImg?: string, signerName?: string, signerFunction?: string) => Promise<void>;
    verifySignature: (code: string) => Promise<Convention | null>;
    updateEmail: (id: string, role: string, newEmail: string) => Promise<void>;

    updateAbsence: (conventionId: string, absenceId: string, reason: string) => Promise<void>;
    reset: () => void;
}

const generateSignatureCode = () => {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const numbers = "0123456789";
    let code = "";
    for (let i = 0; i < 8; i++) code += letters.charAt(Math.floor(Math.random() * letters.length));
    code += "-";
    for (let i = 0; i < 5; i++) code += numbers.charAt(Math.floor(Math.random() * numbers.length));
    return code;
};

// Mock Data
// Mock Data for Simulation
const MOCK_CONVENTION: Convention = {
    id: 'conv_simulation_completed',
    userId: 'mock_user_id',
    studentId: 'etudiant.simu@email.com',
    status: 'VALIDATED_HEAD', // Convention VALIDATED implies internship is active/done
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), // 2 months ago
    updatedAt: new Date().toISOString(),

    // Schema Defaults
    type: 'PFMP_STANDARD',
    language: 'fr',
    ent_pays: 'France',

    // Signatures (All signed)
    signatures: {
        studentAt: "2023-01-15T10:00:00Z",
        studentCode: "ELEVETEST-12345",
        parentAt: "2023-01-15T18:00:00Z",
        parentCode: "PARENTTE-12345",
        teacherAt: "2023-01-16T09:00:00Z",
        teacherCode: "PROFREFE-12345",
        companyAt: "2023-01-16T14:00:00Z",
        companyCode: "ENTREPRI-12345",
        tutorAt: "2023-01-16T14:05:00Z",
        tutorCode: "TUTEURST-12345",
        headAt: "2023-01-17T08:30:00Z",
        headCode: "DIRECTEU-12345",
    },
    // Attestation
    attestationSigned: true,
    attestationDate: "2023-06-30T16:00:00Z",
    attestation_total_jours: 210,
    attestation_signature_code: "ATTESTTE-12345",
    attestation_signer_name: "DUMASDELAGE Tuteur",
    attestation_signer_function: "Responsable Technique",



    // Data fields (Merged)
    ecole_nom: "Lycée Professionnel Jean Jaurès",
    ecole_adresse: "123 Avenue de la République, 75011 Paris",
    ecole_tel: "0143123456",
    ecole_chef_nom: "Mme Martin",
    ecole_chef_email: "demo@pledgeum.fr",
    prof_nom: "M. Dupont",
    prof_email: "demo+teacher@pledgeum.fr",
    cpe_email: "vie-scolaire@lycee-jaures.fr",

    eleve_nom: "Martin",
    eleve_prenom: "Lucas",
    eleve_date_naissance: "2006-03-12",
    eleve_adresse: "15 Rue de la Paix, 75011 Paris",
    eleve_email: "demo+student@pledgeum.fr",
    eleve_tel: "0612345678",
    eleve_cp: "75011",
    eleve_ville: "Paris",
    eleve_classe: "Terminale SN",

    diplome_intitule: "Bac Pro Systèmes Numériques",
    competences: "Maintenance réseau, configuration routeurs.",
    activites: "Installation fibre optique.",

    est_mineur: true,
    rep_legal_nom: "M. Martin Paul",
    rep_legal_prenom: "Paul",
    rep_legal_email: "demo+parent@pledgeum.fr",
    rep_legal_tel: "0698765432",
    rep_legal_adresse: "15 Rue de la Paix, 75011 Paris",

    ent_nom: "Tech Solutions SAS",
    ent_siret: "12345678900012",
    ent_adresse: "45 Boulevard Haussmann",
    ent_code_postal: "75009",
    ent_ville: "Paris",
    ent_rep_nom: "Mme Directrice",
    ent_rep_email: "demo+company_head@pledgeum.fr", // ACCESSIBLE BY USER AS COMPANY_HEAD
    ent_rep_fonction: "PDG",

    tuteur_nom: "M. Tuteur",
    tuteur_email: "demo+tutor@pledgeum.fr", // ACCESSIBLE BY USER AS TUTOR
    tuteur_fonction: "Responsable Technique",
    tuteur_tel: "0102030405",

    stage_date_debut: "2024-10-01", // Past date
    stage_date_fin: "2024-10-31",   // Past date
    stage_duree_heures: 140,
    stage_activites: "Support informatique",
    stage_adresse_differente: false,
    stage_horaires: {},

    // Annexe Financière
    frais_restauration: true,
    frais_transport: false,
    frais_hebergement: false,
    gratification_montant: "600",

    feedbacks: [],
    absences: [],

};

const MOCK_CONVENTION_READY: Convention = {
    ...MOCK_CONVENTION,
    id: 'conv_ready_to_sign',
    studentId: 'alice.ready@email.com',
    eleve_nom: 'Ready',
    eleve_prenom: 'Alice',
    status: 'SIGNED_TUTOR', // Ready for School Head
    ent_nom: 'CyberCorp',
    ent_code_postal: '75000',
    ent_ville: 'Paris',
    tuteur_email: 'pledgeum@gmail.com',
    ent_rep_email: 'pledgeum@gmail.com',
    updatedAt: new Date(Date.now() + 10000).toISOString() // Newer
};

export const useConventionStore = create<ConventionState>((set, get) => ({
    conventions: [], // Start empty, fetch on load

    fetchConventions: async (userId: string, userEmail?: string) => {
        try {
            const { schoolId, role: userRole } = useUserStore.getState();

            // Super Admin Bypass REMOVED for Strict Isolation
            // If Super Admin needs to see all, they must use the Admin Console (not this store)
            // or switch context to a specific school.

            // --- DEMO MODE SIMULATION ---
            // --- DEMO MODE SIMULATION ---
            // Super Admin Bypass
            // --- DEMO MODE SIMULATION ---
            // --- DEMO MODE SIMULATION ---
            // Catch any email starting with demo... or specifically demo@pledgeum.fr
            if (userEmail && (userEmail === 'demo@pledgeum.fr' || (userEmail.startsWith('demo') && userEmail.endsWith('@pledgeum.fr')))) {
                console.log("[DEMO] Fetching Simulated Conventions for:", userEmail);

                // Import demo store dynamically
                const { useDemoStore } = await import('./demo');
                // Infer role from email if possible, otherwise fallback to store
                let demoRole = useDemoStore.getState().demoRole;

                // If the user email suggests a specific role, prioritize that to ensure consistency
                if (userEmail.includes('+student')) demoRole = 'student';
                else if (userEmail.includes('+teacher')) demoRole = 'teacher';
                else if (userEmail.includes('+tutor')) demoRole = 'tutor';
                else if (userEmail.includes('+parent')) demoRole = 'parent';
                else if (userEmail.includes('+company_head')) demoRole = 'company_head';
                else if (userEmail === 'demo@pledgeum.fr') demoRole = 'school_head';

                // Ensure store reflects this role (optional, but good for UI consistency)
                useDemoStore.getState().setDemoRole(demoRole);

                console.log("[DEMO] Generating conventions for role:", demoRole);

                const demoConvs: Convention[] = [];

                // Base Convention Template
                const baseConv: Convention = { ...MOCK_CONVENTION, id: `conv_demo_${demoRole}`, studentId: 'demo+student@pledgeum.fr' };

                if (demoRole === 'student') {
                    // Scenario: Student needs to sign. Convention is validated by teacher but not signed by student yet? 
                    // No, usually Student signs first. So it's DRAFT or SUBMITTED.
                    // Let's make it SUBMITTED (created) but unsigned.
                    demoConvs.push({
                        ...baseConv,
                        id: 'conv_student_action',
                        status: 'SUBMITTED',
                        signatures: { ...baseConv.signatures, studentAt: undefined, studentImg: undefined, studentCode: undefined }, // Clear student signature
                    });
                    // Add a second one: Signed by student/parent, waiting for teacher (ReadOnly view for student)
                    demoConvs.push({
                        ...baseConv,
                        id: 'conv_student_waiting',
                        status: 'SIGNED_PARENT', // Student & Parent signed
                        signatures: {
                            ...baseConv.signatures,
                            teacherAt: undefined, teacherCode: undefined,
                            companyAt: undefined, companyCode: undefined,
                            tutorAt: undefined, tutorCode: undefined,
                            headAt: undefined, headCode: undefined
                        }
                    });
                }
                else if (demoRole === 'teacher') {
                    // Scenario: Teacher needs to validate. Student & Parent signed.
                    demoConvs.push({
                        ...baseConv,
                        id: 'conv_teacher_action',
                        status: 'SIGNED_PARENT', // Ready for teacher
                        signatures: {
                            ...baseConv.signatures,
                            teacherAt: undefined, teacherCode: undefined,
                            companyAt: undefined, companyCode: undefined,
                            tutorAt: undefined, tutorCode: undefined,
                            headAt: undefined, headCode: undefined
                        }
                    });

                    // Add a second one: Validated by teacher, waiting for partners (History view)
                    demoConvs.push({
                        ...baseConv,
                        id: 'conv_teacher_validated',
                        status: 'VALIDATED_TEACHER', // Validated
                        signatures: {
                            ...baseConv.signatures,
                            companyAt: undefined, companyCode: undefined,
                            tutorAt: undefined, tutorCode: undefined,
                            headAt: undefined, headCode: undefined
                        }
                    });
                }
                else if (demoRole === 'tutor') {
                    // Scenario: Tutor needs to sign. Teacher Validated.
                    demoConvs.push({
                        ...baseConv,
                        id: 'conv_tutor_action',
                        status: 'VALIDATED_TEACHER', // Ready for partners
                        signatures: {
                            ...baseConv.signatures,
                            companyAt: undefined, companyCode: undefined,
                            tutorAt: undefined, tutorCode: undefined,
                            headAt: undefined, headCode: undefined
                        }
                    });
                }
                else if (demoRole === 'company_head') {
                    // Scenario: Company Head needs to sign. Teacher Validated.
                    demoConvs.push({
                        ...baseConv,
                        id: 'conv_company_action',
                        status: 'VALIDATED_TEACHER',
                        signatures: {
                            ...baseConv.signatures,
                            companyAt: undefined, companyCode: undefined,
                            tutorAt: undefined, tutorCode: undefined,
                            headAt: undefined, headCode: undefined
                        }
                    });
                }
                else if (demoRole === 'parent') {
                    // Scenario: Parent needs to sign. Student Signed.
                    demoConvs.push({
                        ...baseConv,
                        id: 'conv_parent_action',
                        status: 'SUBMITTED', // Student Signed, Ready for Parent
                        signatures: {
                            ...baseConv.signatures,
                            parentAt: undefined, parentImg: undefined, parentCode: undefined,
                            teacherAt: undefined, teacherCode: undefined,
                            companyAt: undefined, companyCode: undefined,
                            tutorAt: undefined, tutorCode: undefined,
                            headAt: undefined, headCode: undefined
                        }
                    });
                }
                else if (demoRole === 'school_head' || demoRole === 'ddfpt' || demoRole === 'business_manager') {
                    // Scenario: School Head needs to validate final. All others signed.
                    demoConvs.push({
                        ...baseConv,
                        id: 'conv_head_action',
                        status: 'SIGNED_TUTOR', // Waiting for Head
                        signatures: {
                            ...baseConv.signatures,
                            headAt: undefined, headCode: undefined
                        }
                    });

                    // Also add a completed one for reference
                    demoConvs.push({
                        ...baseConv,
                        id: 'conv_head_completed',
                        status: 'VALIDATED_HEAD'
                    });
                }

                set({ conventions: demoConvs });
                return;
            }

            if (userEmail === 'pledgeum@gmail.com' && !schoolId) {
                // Legacy support/Safety net: If "pledgeum" logs in WITHOUT a schoolId (e.g. not initialized),
                // we might want to show nothing or everything?
                // User requirement: "Sépare strictement... ne doit pas mélanger".
                // So showing nothing is safer than showing all.
                // However, to allow "Global Management", we might allow it ONLY if explicitly requested, but here is "User Dashboard".
                // We will Fallback to fetching ONLY their own test conventions (userId check below).
                console.log("Super Admin logged in without School Context - Showing strictly owned conventions.");
                // Proceed to standard queries below...
            }

            const queries = [];

            // 1. Created by user (Owner)
            // Always filter by schoolId if present!
            // EXCEPTION: Students should see their history across schools.
            const isStudent = userRole === 'student';
            const baseConstraints = (schoolId && !isStudent) ? [where("schoolId", "==", schoolId)] : [];

            if (userId) {
                // Students see all their own conventions (cross-school)
                queries.push(query(collection(db, "conventions"), where("userId", "==", userId), ...baseConstraints));
            }

            // 2. Referenced by email (if email is provided)
            if (userEmail) {
                // Determine User Role / School Name for broader query
                // We need access to the User Store state here? 
                // We can't easily access another store inside a store without circular dependency or passing it in.
                // Assuming 'role' is not passed, but we can guess or rely on userEmail queries.

                // CRITICAL: We need to know who the user IS to run the right query (School Name vs Email).
                // Ideally, fetchConventions should take a 'context' object or we look up the user first.
                // BUT: We can just fetch user profile inside here? No, 'fetchConventions' is called AFTER user load.
                // Let's rely on reading the user profile from local storage or passing it in?
                // The signature only has userId/userEmail.

                // WORKAROUND: We query for conventions where 'ecole_chef_email' matches (Old way)
                // AND we also query 'ecole_nom' if we could...
                // SINCE WE CAN'T CHANGE SIGNATURE EASILY:
                // We will add specific queries for ALL standard roles.

                // Standard Roles - Filtered by schoolId if available (except for students)
                queries.push(query(collection(db, "conventions"), where("studentId", "==", userEmail), ...baseConstraints));
                queries.push(query(collection(db, "conventions"), where("prof_email", "==", userEmail), ...baseConstraints));
                queries.push(query(collection(db, "conventions"), where("rep_legal_email", "==", userEmail), ...baseConstraints));
                queries.push(query(collection(db, "conventions"), where("tuteur_email", "==", userEmail), ...baseConstraints));
                queries.push(query(collection(db, "conventions"), where("ent_rep_email", "==", userEmail), ...baseConstraints));

                // For School Head (legacy)
                queries.push(query(collection(db, "conventions"), where("ecole_chef_email", "==", userEmail), ...baseConstraints));

                // --- NEW: Broader Query for School Staff ---
                // If the user is DDFPT/Secretary etc, their EMAIL is likely NOT in the convention fields directly.
                // We need to fetch based on their SCHOOL.
                // We must read the user's school name.
                try {
                    const userDoc = await getDocs(query(collection(db, "users"), where("email", "==", userEmail)));
                    if (!userDoc.empty) {
                        const userData = userDoc.docs[0].data();
                        // Check if role is admin
                        const r = userData.role as UserRole;
                        const adminRoles = ['school_head', 'ddfpt', 'business_manager', 'assistant_manager', 'stewardship_secretary', 'at_ddfpt'];

                        if (adminRoles.includes(r)) {
                            // IF schoolId is present, use IT. Else fallback to name.
                            if (schoolId) {
                                console.log(`[ConventionStore] Fetching by schoolId ${schoolId}`);
                                queries.push(query(collection(db, "conventions"), where("schoolId", "==", schoolId)));
                            } else {
                                const schoolName = userData.profileData?.ecole_nom || userData.schoolName; // normalize field
                                if (schoolName) {
                                    console.log(`[ConventionStore] Fetching school-wide for ${schoolName} (Role: ${r})`);
                                    queries.push(query(collection(db, "conventions"), where("ecole_nom", "==", schoolName)));
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error("Error fetching user context for convention query", e);
                }
            }

            // Execute all queries
            const results = await Promise.all(queries.map(q => getDocs(q)));

            // Deduplicate by ID and final CLIENT-SIDE SchoolId Check (for robustness)
            const conventionsMap = new Map<string, Convention>();
            results.forEach(snapshot => {
                snapshot.forEach(doc => {
                    const data = doc.data() as Convention;

                    // Secondary Safety Net: If schoolId is set in store, strictly enforce it UNLESS Student
                    if (schoolId && !isStudent && data.schoolId && data.schoolId !== schoolId) {
                        return; // Skip mismatch
                    }

                    // --- FILTER OUT GHOST/TEST DATA ---
                    // Hide conventions linked to superadmin testing email 'pledgeum@gmail.com'
                    // Check fields that might define the 'context' of the convention (not the student themselves)
                    const isTestConvention =
                        data.ecole_chef_email === 'pledgeum@gmail.com' ||
                        data.prof_email === 'pledgeum@gmail.com' ||
                        data.ent_rep_email === 'pledgeum@gmail.com' ||
                        data.tuteur_email === 'pledgeum@gmail.com' ||
                        (data.userId && data.userId.includes('pledgeum_test')); // Hypothetical

                    if (isTestConvention) return;
                    // ----------------------------------

                    conventionsMap.set(doc.id, { ...data, id: doc.id });
                });
            });

            set({ conventions: Array.from(conventionsMap.values()) });
        } catch (error) {
            console.error("Error fetching conventions:", error);
        }
    },

    fetchAllConventions: async () => {
        try {
            const q = query(collection(db, "conventions"));
            const snapshot = await getDocs(q);
            const conventions: Convention[] = [];
            snapshot.forEach(doc => {
                conventions.push({ id: doc.id, ...doc.data() } as Convention);
            });
            // Merge with existing or separate? For this feature we likely want to just access the raw list.
            // But to avoid messing with user's view, maybe we just return them? 
            // Better: update state but handle filtering in UI carefully. 
            // OR: Actually, the modal needs them passed in.
            // Let's add a specific 'allConventions' state or just append to conventions and let selector filter?
            // Safer: Just TS definition update here, implementing `getAllConventions` that returns promise/array without setting state.
            return conventions;
        } catch (error) {
            console.error("Error fetching all conventions:", error);
            return [];
        }
    },

    addConvention: (data, studentId) => set((state) => ({
        conventions: [...state.conventions, {
            ...data,
            id: Math.random().toString(36).substr(2, 9),
            studentId,
            schoolId: useUserStore.getState().schoolId, // Inject School ID
            userId: 'temp_user_id',
            status: 'SUBMITTED', // Starts at submitted for simplicity in this demo
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            signatures: {},
            feedbacks: []
        }]
    })),

    updateStatus: (id, newStatus) => set((state) => ({
        conventions: state.conventions.map(c =>
            c.id === id ? { ...c, status: newStatus, updatedAt: new Date().toISOString() } : c
        )
    })),

    // Logique métier de transition d'état lors d'une signature
    // Logique métier de transition d'état lors d'une signature
    signConvention: async (id, role, signatureImage, providedCode, extraAuditLog, dualSign = false) => {
        const { conventions } = get();
        const convention = conventions.find(c => c.id === id);
        if (!convention) return;

        const now = new Date().toISOString();
        const code = providedCode || generateSignatureCode();
        const newSigs = { ...convention.signatures };
        let newStatus = convention.status;

        // Helper to check if a role has signed
        const hasSigned = (r: UserRole) => {
            if (r === 'student') return !!newSigs.studentAt;
            if (r === 'parent') return !!newSigs.parentAt;
            if (r === 'teacher') return !!newSigs.teacherAt;
            if (r === 'company_head') return !!newSigs.companyAt;
            if (r === 'tutor') return !!newSigs.tutorAt;
            if (r === 'school_head') return !!newSigs.headAt;
            return false;
        };

        // State Machine Logic
        if (role === 'student') {
            newSigs.studentAt = now;
            if (signatureImage) newSigs.studentImg = signatureImage;
            newSigs.studentCode = code;

            if (convention.status === 'DRAFT') {
                newStatus = 'SUBMITTED';
            }
        }
        else if (role === 'parent' && convention.est_mineur) {
            if (convention.status === 'SUBMITTED') {
                newSigs.parentAt = now;
                if (signatureImage) newSigs.parentImg = signatureImage;
                newSigs.parentCode = code;
                newStatus = 'SIGNED_PARENT';
            }
        }
        else if (role === 'teacher') {
            const canSign = (convention.est_mineur && convention.status === 'SIGNED_PARENT') ||
                (!convention.est_mineur && (convention.status === 'SUBMITTED' || convention.status === 'SIGNED_PARENT'));

            if (canSign) {
                newSigs.teacherAt = now;
                if (signatureImage) newSigs.teacherImg = signatureImage;
                newSigs.teacherCode = code;
                newStatus = 'VALIDATED_TEACHER';
            }
        }
        else if (role === 'company_head' || role === 'tutor') {
            // Flexible Order Logic: Can sign if Teacher has validated
            // Base condition: Teacher must have validated (so status is at least VALIDATED_TEACHER)
            // Or partners already started signing (SIGNED_COMPANY, SIGNED_TUTOR)
            const isReadyForPartners = ['VALIDATED_TEACHER', 'SIGNED_COMPANY', 'SIGNED_TUTOR'].includes(convention.status);

            if (isReadyForPartners) {
                // Apply Main Signature
                if (role === 'company_head') {
                    newSigs.companyAt = now;
                    if (signatureImage) newSigs.companyImg = signatureImage;
                    newSigs.companyCode = code;
                }
                if (role === 'tutor') {
                    newSigs.tutorAt = now;
                    if (signatureImage) newSigs.tutorImg = signatureImage;
                    newSigs.tutorCode = code;
                }

                // Apply Dual Signature if requested
                if (dualSign) {
                    const dualRole = role === 'company_head' ? 'tutor' : 'company_head';
                    // We use the same image and code? Or generate new?
                    // To imply "delegation" or "same person", same image + same code is appropriate.
                    // But technically they are distinct fields.
                    if (dualRole === 'company_head') {
                        newSigs.companyAt = now;
                        if (signatureImage) newSigs.companyImg = signatureImage;
                        newSigs.companyCode = code;
                    } else {
                        newSigs.tutorAt = now;
                        if (signatureImage) newSigs.tutorImg = signatureImage;
                        newSigs.tutorCode = code;
                    }
                }

                // Determine New Status
                // If BOTH Company and Tutor have signed -> SIGNED_TUTOR (Ready for Head)
                // If only Company -> SIGNED_COMPANY
                // If only Tutor -> VALIDATED_TEACHER (technically unchanged status, but signature added)
                // NOTE: We rely on checking the updated `newSigs` object
                const companySigned = !!newSigs.companyAt;
                const tutorSigned = !!newSigs.tutorAt;

                if (companySigned && tutorSigned) {
                    newStatus = 'SIGNED_TUTOR'; // Both signed, ready for Head
                } else if (companySigned) {
                    newStatus = 'SIGNED_COMPANY'; // Company signed, waiting for Tutor
                } else if (tutorSigned) {
                    // Tutor signed, waiting for Company.
                    // We keep VALIDATED_TEACHER so UI says "En attente : Chef d'Entreprise" (via Logic in page.tsx)
                    // Or we introduce a new status? Let's stick to existing statuses to avoid breaking UI.
                    // VALIDATED_TEACHER effectively means "Waiting for Company/Partners"
                    newStatus = 'VALIDATED_TEACHER';
                }
            }
        }
        else if (role === 'school_head' && convention.status === 'SIGNED_TUTOR') {
            newSigs.headAt = now;
            if (signatureImage) newSigs.headImg = signatureImage;
            newSigs.headCode = code;
            newStatus = 'VALIDATED_HEAD';
        }

        try {
            // Verify if (status changed) OR (signatures changed)
            // We compare signature timestamps count to detect if a signature was added
            const countSigs = (s: any) => [s.studentAt, s.parentAt, s.teacherAt, s.companyAt, s.tutorAt, s.headAt].filter(Boolean).length;
            const oldSigCount = countSigs(convention.signatures);
            const newSigCount = countSigs(newSigs);

            const signaturesChanged = newSigCount > oldSigCount;
            const statusChanged = newStatus !== convention.status;

            const allowedResign =
                (role === 'student' && ['DRAFT', 'SUBMITTED', 'REJECTED'].includes(convention.status)) ||
                (role === 'parent' && convention.status === 'SIGNED_PARENT') ||
                (role === 'teacher' && convention.status === 'VALIDATED_TEACHER') ||
                (role === 'company_head' && convention.status === 'SIGNED_COMPANY') ||
                (role === 'tutor' && convention.status === 'SIGNED_TUTOR') ||
                (role === 'school_head' && convention.status === 'VALIDATED_HEAD');

            if (!statusChanged && !signaturesChanged && !allowedResign) {
                console.warn(`Signature ignored: Status ${newStatus} unchanged for role ${role}. (Minor: ${convention.est_mineur}, Status: ${convention.status})`);
                throw new Error(`La signature n'a pas pu être prise en compte. Statut: ${convention.status}, Rôle: ${role}.`);
            }

            // Compute Verification Hash (Server-Side Logic via Action)
            // Create a preview of the new state to generate the correct signature
            const tempConvention = {
                ...convention,
                signatures: newSigs,
                status: newStatus,
            } as Convention;

            const { hashDisplay } = await generateVerificationUrl(tempConvention, 'convention');

            // Persist to Firestore (SKIP IN DEMO MODE)
            if (!useDemoStore.getState().isDemoMode) {
                const convRef = doc(db, "conventions", id);
                await updateDoc(convRef, {
                    status: newStatus,
                    signatures: newSigs,
                    certificateHash: hashDisplay,
                    updatedAt: now,
                    auditLogs: arrayUnion({
                        date: now,
                        action: 'SIGNED',
                        actorEmail: role === 'student' ? convention.eleve_email :
                            role === 'parent' ? convention.rep_legal_email :
                                role === 'teacher' ? convention.prof_email :
                                    role === 'tutor' ? convention.tuteur_email :
                                        role === 'company_head' ? convention.ent_rep_email :
                                            role === 'school_head' ? convention.ecole_chef_email : 'unknown',
                        details: `Signature par ${role} `
                    })
                });
            } else {
                console.log("[DEMO] Skipped Firestore write for SIGNED");
            }

            // Update Local State
            set((state) => ({
                conventions: state.conventions.map(c =>
                    c.id === id ? {
                        ...c,
                        signatures: newSigs,
                        status: newStatus,
                        updatedAt: now,
                        auditLogs: [
                            ...(c.auditLogs || []),
                            ...(extraAuditLog ? [extraAuditLog] : []),
                            {
                                date: now,
                                action: 'SIGNED',
                                actorEmail: (role === 'student' ? convention.eleve_email :
                                    role === 'parent' ? convention.rep_legal_email :
                                        role === 'teacher' ? convention.prof_email :
                                            role === 'tutor' ? convention.tuteur_email :
                                                role === 'company_head' ? convention.ent_rep_email :
                                                    role === 'school_head' ? convention.ecole_chef_email : 'unknown') || 'unknown',
                                details: `Signature par ${role} `
                            }
                        ]
                    } : c
                )
            }));

            // Determine Dashboard Link based on Environment
            const origin = typeof window !== 'undefined' ? window.location.origin : '';
            const isLocal = origin.includes('localhost');
            const dashboardLink = isLocal ? 'http://localhost:3000/' : 'https://www.pledgeum.fr/';

            if (newStatus === 'SUBMITTED') {
                // Student has signed -> Notify Parent (if minor) or Teacher (if major)
                if (convention.est_mineur && convention.rep_legal_email) {
                    await sendNotification(
                        convention.rep_legal_email,
                        `Convention PFMP à signer - ${convention.eleve_prenom} ${convention.eleve_nom}`,
                        `Bonjour,\n\nVotre enfant ${convention.eleve_prenom} ${convention.eleve_nom} a signé sa convention de stage.\nMerci de la signer à votre tour : ${dashboardLink}`
                    );
                } else {
                    await sendNotification(
                        convention.prof_email,
                        `Convention PFMP à valider - ${convention.eleve_prenom} ${convention.eleve_nom}`,
                        `Bonjour,\n\nL'élève ${convention.eleve_prenom} ${convention.eleve_nom} (Majeur) a signé sa convention.\nMerci de la valider : ${dashboardLink}`
                    );
                }
            }
            else if (newStatus === 'SIGNED_PARENT') {
                // Parent has signed -> Notify Teacher to Validate
                const parentName = convention.rep_legal_prenom ? `${convention.rep_legal_prenom} ${convention.rep_legal_nom}` : convention.rep_legal_nom;
                await sendNotification(
                    convention.prof_email,
                    `Convention PFMP à valider - ${convention.eleve_prenom} ${convention.eleve_nom} - ${convention.ecole_nom}`,
                    `Bonjour,\n\nLe représentant légal (${parentName}) de l'élève ${convention.eleve_prenom} ${convention.eleve_nom} (Classe: ${convention.eleve_classe}) a signé la convention pour le stage chez ${convention.ent_nom} (${convention.ent_ville}).\n\nMerci de vérifier et valider la convention : ${dashboardLink}\n\nCordialement.`
                );
            }
            else if (newStatus === 'VALIDATED_TEACHER') {
                // Teacher has validated -> Notify Company
                await sendNotification(
                    convention.ent_rep_email,
                    `Convention PFMP à signer - ${convention.eleve_prenom} ${convention.eleve_nom} - ${convention.ecole_nom}`,
                    `Bonjour,\n\nLa convention de l'élève ${convention.eleve_prenom} ${convention.eleve_nom} (Classe: ${convention.eleve_classe}) pour le stage chez ${convention.ent_nom} (${convention.ent_ville}) a été validée par l'enseignant référent (${convention.prof_nom}).\n\nC'est à votre tour de signer : ${dashboardLink}\n\nCordialement.`
                );
            }
            else if (newStatus === 'SIGNED_COMPANY') {
                await sendNotification(
                    convention.tuteur_email,
                    `Convention PFMP à signer - ${convention.eleve_prenom} ${convention.eleve_nom} - ${convention.ecole_nom}`,
                    `Bonjour,\n\nLe représentant de l'entreprise (${convention.ent_rep_nom}) a signé la convention de l'élève ${convention.eleve_prenom} ${convention.eleve_nom} (Classe: ${convention.eleve_classe}) pour le stage chez ${convention.ent_nom} (${convention.ent_ville}).\n\nMerci de la valider : ${dashboardLink}\n\nCordialement.`
                );
            }
            else if (newStatus === 'SIGNED_TUTOR') {
                const tutorName = convention.tuteur_prenom ? `${convention.tuteur_prenom} ${convention.tuteur_nom}` : convention.tuteur_nom;
                await sendNotification(
                    convention.ecole_chef_email,
                    `Convention PFMP à valider - ${convention.eleve_prenom} ${convention.eleve_nom} - ${convention.ecole_nom}`,
                    `Bonjour,\n\nLe tuteur (${tutorName}) a signé la convention de l'élève ${convention.eleve_prenom} ${convention.eleve_nom} (Classe: ${convention.eleve_classe}) pour le stage chez ${convention.ent_nom} (${convention.ent_ville}).\n\nMerci de procéder à la validation finale : ${dashboardLink}\n\nCordialement.`
                );
            }
            else if (newStatus === 'VALIDATED_HEAD') {
                // FINAL VALIDATION: Notify EVERYONE
                const subject = `Convention PFMP Finalisée - ${convention.eleve_prenom} ${convention.eleve_nom} - ${convention.ecole_nom}`;
                const msg = `Bonjour,\n\nLa convention de stage de l'élève ${convention.eleve_prenom} ${convention.eleve_nom} (Classe: ${convention.eleve_classe}) chez ${convention.ent_nom} (${convention.ent_ville}) a été signée par tous et validée par le Chef d'Établissement (${convention.ecole_chef_nom}).\n\nVous pouvez télécharger le document final sur votre tableau de bord : ${dashboardLink}\n\nBon stage !`;

                const recipients = [
                    convention.eleve_email,
                    convention.prof_email,
                    convention.ent_rep_email,
                    convention.tuteur_email,
                    // Parent only if minor
                    convention.est_mineur ? convention.rep_legal_email : null,
                    // EXPLICITLY EXCLUDED: convention.ecole_chef_email (School Head does not want final email)
                ].filter(Boolean) as string[];

                // Send in parallel
                await Promise.all(recipients.map(email => sendNotification(email, subject, msg)));
            }
        } catch (error) {
            console.error("Error signing convention:", error);
            throw error;
        }
    },


    addFeedback: (id, author, message) => set((state) => ({
        conventions: state.conventions.map(c =>
            c.id === id
                ? {
                    ...c,
                    status: 'REJECTED',
                    feedbacks: [...c.feedbacks, { author, message, date: new Date().toISOString() }]
                }
                : c
        )
    })),

    getConventionsByRole: (role, userEmail, currentUserId) => {
        const { conventions } = get();

        // Super Admin / Test Account Bypass
        if (userEmail === 'pledgeum@gmail.com') {
            return conventions;
        }

        // Simple mock filtering logic
        if (role === 'student') {
            return conventions.filter(c => c.studentId === userEmail || (currentUserId && c.userId === currentUserId));
        }
        if (role === 'teacher') return conventions.filter(c => c.prof_email === userEmail); // In reality, match by ID
        if (role === 'teacher_tracker') return conventions.filter(c => c.prof_suivi_email === userEmail);

        // --- School Admin Roles: View ALL for their school ---
        const schoolAdminRoles = ['school_head', 'ddfpt', 'business_manager', 'assistant_manager', 'stewardship_secretary', 'at_ddfpt'];
        if (schoolAdminRoles.includes(role)) {
            // For now, we assume conventions are already filtered by fetchConventions to the user's school.
            // But if we have multiple schools in cache (unlikely), we should filter by school name from profile?
            // Simplest: Return all loaded conventions because fetchConventions should have done the job.
            // OR: Logic to filter by ecole_chef_email if it's strictly head?
            // REVISED: If fetchConventions did its job, we just return the list.
            // BUT: 'school_head' was previously filtering by email. Let's keep that for specific head assignment?
            // No, Head should see all.
            return conventions;
        }

        if (role === 'company_head') return conventions.filter(c => c.ent_rep_email === userEmail);
        if (role === 'tutor') return conventions.filter(c => c.tuteur_email === userEmail);
        if (role === 'parent') return conventions.filter(c => c.rep_legal_email === userEmail);
        return [];
    },

    submitConvention: async (data, studentId, userId) => {
        try {
            // Create local object first for optimistic/local update or just structure
            const newConvention: Omit<Convention, 'id'> = {
                ...data,
                userId,
                studentId,
                status: 'SUBMITTED',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                signatures: {
                    studentAt: new Date().toISOString(),
                    studentImg: data.signatures?.studentImg,
                    studentCode: generateSignatureCode() // Generate Unique ID for Student
                },
                feedbacks: []
            };

            // Firestore add (With Demo Bypass)
            let newId = "";
            if (!useDemoStore.getState().isDemoMode) {
                const docRef = await addDoc(collection(db, "conventions"), newConvention);
                newId = docRef.id;
                console.log("Document written with ID: ", newId);
            } else {
                newId = "demo_conv_" + Math.random().toString(36).substr(2, 9);
                console.log("[DEMO] Generated fake ID: ", newId);
            }

            // Update local state with the real ID
            set((state) => ({
                conventions: [...state.conventions, { ...newConvention, id: newId }]
            }));
            // Send Email Notification
            // Send Email Notification to Student (Confirmation)
            if (data.eleve_email) {
                await sendNotification(
                    data.eleve_email,
                    `Confirmation : Convention PFMP - ${data.eleve_prenom} ${data.eleve_nom} - ${data.ecole_nom}`,
                    `Bonjour ${data.eleve_prenom},\n\nVotre convention de stage (Classe: ${data.eleve_classe}) pour l'entreprise ${data.ent_nom} (${data.ent_ville}) a bien été signée par vous-même (l'élève) et enregistrée.\n\nElle doit maintenant être validée par votre enseignant référent/professeur principal.\n\nCordialement,\nL'équipe PFMP`
                );
            }

            // Determine Dashboard Link based on Environment
            const origin = typeof window !== 'undefined' ? window.location.origin : '';
            const isLocal = origin.includes('localhost');
            const dashboardLink = isLocal ? 'http://localhost:3000/' : 'https://www.pledgeum.fr/';

            if (data.est_mineur && data.rep_legal_email) {
                await sendNotification(
                    data.rep_legal_email,
                    `Convention PFMP à signer - ${data.eleve_prenom} ${data.eleve_nom} - ${data.ecole_nom}`,
                    `Bonjour,\n\nLa convention de stage de l'élève ${data.eleve_prenom} ${data.eleve_nom} (Classe: ${data.eleve_classe}) chez ${data.ent_nom} (${data.ent_ville}) vient d'être signée par l'élève.\n\nMerci de vous connecter pour vérifier les informations et la signer : ${dashboardLink}\n\nCordialement.`
                );
            } else if (data.prof_email) {
                await sendNotification(
                    data.prof_email,
                    `Convention PFMP à valider - ${data.eleve_prenom} ${data.eleve_nom} - ${data.ecole_nom}`,
                    `Bonjour,\n\nLa convention de stage de l'élève ${data.eleve_prenom} ${data.eleve_nom} (Classe: ${data.eleve_classe}) chez ${data.ent_nom} (${data.ent_ville}) vient d'être signée par l'élève (Majeur).\n\nConnectez-vous pour la valider : ${dashboardLink}\n\nCordialement.`
                );
            }
        } catch (e) {
            console.error("Error adding document: ", e);
            throw e; // Re-throw to be handled by UI
        }
    },
    updateConvention: async (id, data) => {
        try {
            if (!useDemoStore.getState().isDemoMode) {
                await updateDoc(doc(db, "conventions", id), {
                    ...data,
                    updatedAt: new Date().toISOString()
                });
            } else {
                console.log("[DEMO] Skipped Firestore update");
            }

            set((state) => ({
                conventions: state.conventions.map(c =>
                    c.id === id ? { ...c, ...data, updatedAt: new Date().toISOString() } : c
                )
            }));
        } catch (error) {
            console.error("Error updating convention:", error);
            throw error;
        }
    },

    sendReminder: async (id) => {
        const { conventions } = get();
        const convention = conventions.find(c => c.id === id);
        if (!convention) return;

        let recipientEmail = '';
        let recipientRoleName = '';
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const isLocal = origin.includes('localhost');
        const dashboardLink = isLocal ? 'http://localhost:3000/' : 'https://www.pledgeum.fr/';

        // Determine who to remind
        switch (convention.status) {
            case 'SUBMITTED':
                if (convention.est_mineur) {
                    recipientEmail = convention.rep_legal_email || '';
                    recipientRoleName = "Représentant Légal";
                } else {
                    recipientEmail = convention.prof_email;
                    recipientRoleName = "Enseignant Référent";
                }
                break;
            case 'SIGNED_PARENT':
                recipientEmail = convention.prof_email;
                recipientRoleName = "Enseignant Référent";
                break;
            case 'VALIDATED_TEACHER':
                recipientEmail = convention.ent_rep_email;
                recipientRoleName = "Chef d'Entreprise";
                break;
            case 'SIGNED_COMPANY':
                recipientEmail = convention.tuteur_email;
                recipientRoleName = "Tuteur";
                break;
            case 'SIGNED_TUTOR':
                recipientEmail = convention.ecole_chef_email;
                recipientRoleName = "Chef d'Établissement scolaire";
                break;
            default:
                return; // No one to remind or finished
        }

        // Check Cooldown
        const now = new Date().getTime();
        if (convention.lastReminderAt) {
            const lastSent = new Date(convention.lastReminderAt).getTime();
            // Production: 2 days = 48 * 60 * 60 * 1000
            // Test Mode: 5 seconds (to match UI test requirement)
            // Using 2 days as requested for the enforcement rule, but maybe user wants to test it? 
            // The prompt says "durant deux jours" (during 2 days). 
            // I'll set it to 2 days for the *blocking* logic as requested by "aucun autre... durant deux jours".
            // BUT for testing... I'll uncomment the short version.
            const COOLDOWN = 48 * 60 * 60 * 1000;
            // const COOLDOWN = 5000; // Uncheck for fast testing

            if (now - lastSent < COOLDOWN) {
                console.warn("Reminder cooldown active.");
                throw new Error("Veuillez attendre 48h avant de relancer à nouveau.");
            }
        }

        if (!recipientEmail) return;

        try {
            const formattedStart = new Date(convention.stage_date_debut).toLocaleDateString('fr-FR');
            const formattedEnd = convention.stage_date_fin ? new Date(convention.stage_date_fin).toLocaleDateString('fr-FR') : '?';

            const emailBody = `Respectueusement,\n\nAu nom de l'établissement ${convention.ecole_nom}, nous nous permettons de vous solliciter concernant la signature de la convention de stage, actuellement en attente.\n\nDétails :\n- Élève : ${convention.eleve_prenom} ${convention.eleve_nom}\n- Classe : ${convention.eleve_classe}\n- Période : Du ${formattedStart} au ${formattedEnd}\n- Tuteur : ${convention.tuteur_nom}\n- Enseignant Référent/Prof. Principal : ${convention.prof_nom}\n\nNous vous serions reconnaissants de bien vouloir vérifier et signer ce document dès que possible en suivant ce lien : ${dashboardLink}\n\nEn vous remerciant par avance,\nL'équipe PFMP`;

            await sendNotification(
                recipientEmail,
                `Rappel : Convention en attente - ${convention.eleve_prenom} ${convention.eleve_nom} - ${convention.ecole_nom}`,
                emailBody
            );

            // Update lastReminderAt in DB and State
            const reminderTimestamp = new Date().toISOString();
            if (!useDemoStore.getState().isDemoMode) {
                await updateDoc(doc(db, "conventions", id), {
                    lastReminderAt: reminderTimestamp
                });
            }

            set((state) => ({
                conventions: state.conventions.map(c =>
                    c.id === id ? { ...c, lastReminderAt: reminderTimestamp } : c
                )
            }));

            console.log(`Reminder sent to ${recipientEmail} for convention ${id}`);
        } catch (error) {
            console.error("Error sending reminder:", error);
            throw error;
        }
    },

    bulkSignConventions: async (ids, role, signatureImage) => {
        const { signConvention } = get();
        try {
            // Process signatures sequentially to avoid race conditions or heavy load
            for (const id of ids) {
                await signConvention(id, role, signatureImage);
            }
        } catch (error) {
            console.error("Error in bulk signing:", error);
            throw error;
        }
    },

    reportAbsence: async (conventionId, absenceData) => {
        try {
            const convention = get().conventions.find(c => c.id === conventionId);
            if (!convention) throw new Error("Convention introuvable");

            const newAbsence: Absence = {
                ...absenceData,
                id: Math.random().toString(36).substr(2, 9),
                reportedAt: new Date().toISOString()
            };

            const updatedAbsences = [...(convention.absences || []), newAbsence];

            if (!useDemoStore.getState().isDemoMode) {
                await updateDoc(doc(db, "conventions", conventionId), {
                    absences: updatedAbsences
                });
            }

            // Notifications
            const subject = `[PFMP] Signalement d'absence - ${convention.eleve_prenom} ${convention.eleve_nom}`;
            const message = `
                Une absence a été signalée pour l'élève ${convention.eleve_prenom} ${convention.eleve_nom}.
                Type : ${newAbsence.type === 'absence' ? 'Absence' : 'Retard'}
                Date : ${new Date(newAbsence.date).toLocaleDateString('fr-FR')}
                Durée : ${newAbsence.duration} heures
                Justification : ${newAbsence.reason || 'Aucune'}
                Signalé par : ${newAbsence.reportedBy}
            `;

            const recipients = [convention.prof_email];
            if (convention.est_mineur && convention.rep_legal_email) recipients.push(convention.rep_legal_email);
            if (convention.cpe_email) recipients.push(convention.cpe_email!);

            recipients.filter((e): e is string => !!e).forEach(async (email) => {
                await sendNotification(email, subject, message);
                console.log(`[EMAIL] Absence report sent to ${email}`);
            });

            set((state) => ({
                conventions: state.conventions.map(c =>
                    c.id === conventionId ? { ...c, absences: updatedAbsences } : c
                )
            }));
        } catch (error) {
            console.error("Error reporting absence:", error);
            throw error;
        }
    },

    updateAbsence: async (conventionId, absenceId, reason) => {
        try {
            const convention = get().conventions.find(c => c.id === conventionId);
            if (!convention) throw new Error("Convention introuvable");

            const updatedAbsences = convention.absences?.map(a =>
                a.id === absenceId ? { ...a, reason } : a
            ) || [];

            await updateDoc(doc(db, "conventions", conventionId), {
                absences: updatedAbsences
            });

            set((state) => ({
                conventions: state.conventions.map(c =>
                    c.id === conventionId ? { ...c, absences: updatedAbsences } : c
                )
            }));
        } catch (error) {
            console.error("Error updating absence:", error);
            throw error;
        }
    },

    validateAttestation: async (conventionId, finalAbsencesCount, signatureImg, signerName, signerFunction) => {
        try {
            const convention = get().conventions.find(c => c.id === conventionId);
            if (!convention) throw new Error("Convention introuvable");

            const code = generateSignatureCode();
            const attestationData = {
                attestationSigned: true,
                attestationDate: new Date().toISOString(),
                attestation_signature_img: signatureImg,
                attestation_signature_code: code,
                attestation_signer_name: signerName,
                attestation_signer_function: signerFunction
            };

            // Compute Hash
            const tempConv = { ...convention, ...attestationData } as Convention;
            const { hashDisplay } = await generateVerificationUrl(tempConv, 'attestation');

            if (!useDemoStore.getState().isDemoMode) {
                await updateDoc(doc(db, "conventions", conventionId), {
                    ...attestationData,
                    attestationHash: hashDisplay,
                    auditLogs: arrayUnion({
                        date: new Date().toISOString(),
                        action: 'ATTESTATION_SIGNED' as const,
                        actorEmail: convention.ent_rep_email, // Assuming signed by company rep usually
                        details: `Signature de l'attestation par ${signerName} (${signerFunction})`
                    })
                });
            }

            const newLog: AuditLog = {
                date: new Date().toISOString(),
                action: 'ATTESTATION_SIGNED',
                actorEmail: convention.ent_rep_email,
                details: `Signature de l'attestation par ${signerName} (${signerFunction})`
            };

            set((state) => ({
                conventions: state.conventions.map(c =>
                    c.id === conventionId ? {
                        ...c,
                        ...attestationData,
                        attestationHash: hashDisplay,
                        auditLogs: [...(c.auditLogs || []), newLog]
                    } : c
                )
            }));

            // Notify Teacher
            await sendNotification(
                convention.prof_email,
                `Attestation de stage signée - ${convention.eleve_prenom} ${convention.eleve_nom}`,
                `Bonjour,\n\nL'attestation de stage pour ${convention.eleve_prenom} ${convention.eleve_nom} a été validée et signée par l'entreprise.\n\nVous pouvez la consulter sur le tableau de bord.\n\nCordialement.`
            );

        } catch (error) {
            console.error("Error validating attestation:", error);
            throw error;
        }
    },

    assignTrackingTeacher: async (conventionId, trackingTeacherEmail) => {
        try {
            if (!useDemoStore.getState().isDemoMode) {
                await updateDoc(doc(db, "conventions", conventionId), {
                    prof_suivi_email: trackingTeacherEmail
                });
            }
            set((state) => ({
                conventions: state.conventions.map(c =>
                    c.id === conventionId ? { ...c, prof_suivi_email: trackingTeacherEmail } : c
                )
            }));
            console.log(`[STORE] Assigned tracking teacher ${trackingTeacherEmail} to convention ${conventionId}`);

            // === Automatic Mission Order Creation ===
            if (trackingTeacherEmail) {
                const { getCoordinates, calculateDistance } = await import('@/lib/geocoding');
                const { useSchoolStore } = await import('@/store/school');
                const { useMissionOrderStore } = await import('@/store/missionOrder');

                const convention = get().conventions.find(c => c.id === conventionId);
                const schoolAddress = useSchoolStore.getState().schoolAddress;

                if (convention && schoolAddress) {
                    const companyAddress = `${convention.ent_adresse}, ${convention.ent_code_postal} ${convention.ent_ville}`;

                    // 1. Geocode both addresses
                    // Used simplified 0,0 fallback if fail, or improve error handling
                    const schoolCoords = await getCoordinates(schoolAddress);
                    const companyCoords = await getCoordinates(companyAddress);

                    let distanceKm = 0;
                    if (schoolCoords && companyCoords) {
                        distanceKm = calculateDistance(
                            schoolCoords.lat, schoolCoords.lon,
                            companyCoords.lat, companyCoords.lon
                        );
                    }

                    // 2. Create Mission Order
                    await useMissionOrderStore.getState().createMissionOrder({
                        conventionId: convention.id,
                        teacherId: trackingTeacherEmail, // Email as ID for now
                        studentId: convention.studentId, // or name
                        schoolAddress,
                        companyAddress,
                        distanceKm: Math.round(distanceKm * 10) / 10 // Round to 1 decimal
                    });

                    console.log(`[ODM] Created Mission Order for ${trackingTeacherEmail} (Dist: ${distanceKm}km)`);
                }
            }
        } catch (error) {
            console.error("Error assigning tracking teacher:", error);
            throw error;
        }
    },

    verifySignature: async (code) => {
        const { conventions } = get();

        // 1. Check Local State First (Fast)
        for (const conv of conventions) {
            const s = conv.signatures;
            if (s.studentCode === code || s.parentCode === code || s.teacherCode === code || s.companyCode === code || s.tutorCode === code || s.headCode === code) {
                return conv;
            }
            if (conv.attestation_signature_code === code) {
                return conv;
            }
            // Check Hashes
            if (conv.certificateHash === code || conv.attestationHash === code) {
                return conv;
            }
        }

        // 2. Global Firestore Query (Fallback for deleted accounts / unloaded conventions)
        try {
            // We need to import 'or' from firebase/firestore, assuming it is available. 
            // If not, we run parallel queries.
            // Using parallel queries here to be safe and compatible without potentially missing 'or' import/support issues for now, or just use 'or' if I add the import.
            // Let's rely on multiple queries for robustness if indices are missing for complex ORs.
            // Actually, for single field equalities, OR is fine.
            // But let's do parallel queries since we haven't checked 'or' import in the file yet.
            // Wait, I can just add the import in a separate edit or assume I can add it here? 
            // I'll stick to parallel queries for maximum compatibility without needing complex index setups.

            const queries = [
                query(collection(db, "conventions"), where("signatures.studentCode", "==", code)),
                query(collection(db, "conventions"), where("signatures.parentCode", "==", code)),
                query(collection(db, "conventions"), where("signatures.teacherCode", "==", code)),
                query(collection(db, "conventions"), where("signatures.companyCode", "==", code)),
                query(collection(db, "conventions"), where("signatures.tutorCode", "==", code)),
                query(collection(db, "conventions"), where("signatures.headCode", "==", code)),
                query(collection(db, "conventions"), where("attestation_signature_code", "==", code)),
                // Add queries for Document Hashes
                query(collection(db, "conventions"), where("certificateHash", "==", code)),
                query(collection(db, "conventions"), where("attestationHash", "==", code))
            ];

            const snapshots = await Promise.all(queries.map(q => getDocs(q)));

            for (const snap of snapshots) {
                if (!snap.empty) {
                    const doc = snap.docs[0];
                    return { id: doc.id, ...doc.data() } as Convention;
                }
            }

        } catch (e) {
            console.error("Error verifying signature globally:", e);
        }

        return null;
    },

    updateEmail: async (id, role, newEmail) => {
        try {
            const convention = get().conventions.find(c => c.id === id);
            if (!convention) throw new Error("Convention introuvable");

            // Map role to email field
            const roleToField: Record<string, keyof ConventionData> = {
                'student': 'eleve_email',
                'parent': 'rep_legal_email',
                'teacher': 'prof_email',
                'company': 'ent_rep_email',
                'tutor': 'tuteur_email',
                'head': 'ecole_chef_email'
            };

            const field = roleToField[role];
            if (!field) throw new Error("Rôle inconnu pour mise à jour email");

            // Remove role from invalidEmails list
            const updatedInvalidEmails = (convention.invalidEmails || []).filter(r => r !== role);

            const updatePayload: any = {
                [field]: newEmail,
                invalidEmails: updatedInvalidEmails,
                updatedAt: new Date().toISOString()
            };

            await updateDoc(doc(db, "conventions", id), updatePayload);

            set((state) => ({
                conventions: state.conventions.map(c =>
                    c.id === id ? { ...c, ...updatePayload } : c
                )
            }));

            console.log(`Email updated for ${role} in convention ${id}`);
        } catch (error) {
            console.error("Error updating email:", error);
            throw error;
        }
    },

    reset: () => set({ conventions: [] })
}));
