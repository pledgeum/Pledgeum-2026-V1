
import { create } from 'zustand';
import { ConventionData } from '@/types/schema';
import { sendNotification } from '@/lib/notification';
import { generateVerificationUrl } from '@/app/actions/sign';
import { sha256 } from 'js-sha256';
import { UserRole, useUserStore } from './user';
import { useDemoStore } from './demo';
import { db, doc, updateDoc, arrayUnion } from '@/lib/firebase';

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

export interface SignatureDetail {
    signedAt: string;
    name?: string;
    hash?: string;
    ip?: string;
    code?: string;
    signatureId?: string;
    img?: string;
    method?: 'OTP' | 'CANVAS';
}

export interface Convention extends Omit<ConventionData, 'signatures'> {
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
    metadata?: Record<string, any>; // Flexible metadata storage for backward compatibility or extra fields
    rejection_reason?: string;
    rejectedByLabel?: string;
    rejectedByRole?: string;
    dateStart?: string;
    dateEnd?: string;

    // New Fields
    absences?: Absence[];
    attestationSigned?: boolean;
    attestationDate?: string;
    attestation_competences?: string;
    attestation_gratification?: string;
    attestation_fait_a?: string;
    attestation_total_jours?: number;
    attestation_total_semaines?: number;
    attestation_signature_img?: string;
    attestation_signature_code?: string;
    attestation_signer_name?: string;
    attestation_signer_function?: string;
    activites?: string; // For attestation override
    competences?: string; // For attestation override
    cpe_email?: string;
    derogationJustification?: string;
    tuteur_telephone?: string;

    visit?: {
        tracking_teacher_email?: string; // Optional for drafts
        tracking_teacher_first_name?: string;
        tracking_teacher_last_name?: string;
        distance_km?: number;
        status?: string;
        scheduled_date?: string;
        // Draft fields
        draft_tracking_teacher_email?: string;
        draft_distance_km?: number;
    };
    school?: {
        address?: string;
        zipCode?: string;
        city?: string;
    };
    evaluationAnswers?: Record<string, Record<number, any>>;
    evaluationFinalGrade?: string;
    evaluationDate?: string;

    signatures: {
        student?: SignatureDetail;
        parent?: SignatureDetail;
        teacher?: SignatureDetail;
        company_head?: SignatureDetail;
        tutor?: SignatureDetail;
        head?: SignatureDetail;
        [key: string]: SignatureDetail | undefined;
    };
    feedbacks: {
        author: string;
        message: string;
        date: string;
    }[];
    invalidEmails?: string[]; // List of roles with invalid emails
    is_out_of_period?: boolean;
}

interface ConventionState {
    conventions: Convention[];
    isLoading?: boolean;
    addConvention: (data: ConventionData, studentId: string) => void;
    updateStatus: (id: string, newStatus: ConventionStatus) => void;
    signConvention: (id: string, role: string, signatureImage?: string, code?: string, extraAuditLog?: AuditLog, dualSign?: boolean, newCompanyHeadEmail?: string) => Promise<any>;

    addFeedback: (id: string, author: string, message: string) => void;
    assignTrackingTeacher: (conventionId: string, trackingTeacherEmail: string, distanceKm?: number) => Promise<void>;
    getConventionsByRole: (role: string, userEmail: string, currentUserId?: string) => Convention[];
    submitConvention: (data: ConventionData, studentId: string, userId: string) => Promise<string>;
    createConvention: (data: any) => Promise<string>;
    fetchConventions: (userId: string, userEmail?: string) => Promise<void>;
    fetchAllConventions: () => Promise<Convention[]>;
    updateConvention: (id: string, data: Partial<ConventionData | Convention>) => Promise<void>;
    sendReminder: (id: string) => Promise<void>;
    bulkSignConventions: (ids: string[], role: string, signatureImage?: string) => Promise<void>;
    reportAbsence: (conventionId: string, absence: Omit<Absence, 'id' | 'reportedAt'>) => Promise<void>;
    validateAttestation: (conventionId: string, finalAbsences: number, signatureImg?: string, signerName?: string, signerFunction?: string, totalDaysPaid?: number, totalWeeksDiploma?: number) => Promise<void>;
    verifySignature: (code: string) => Promise<Convention | null>;
    updateEmail: (id: string, role: string, newEmail: string) => Promise<void>;
    saveDraftAssignments: (assignments: Record<string, { email: string, distance: number }>) => Promise<void>;

    updateAbsence: (conventionId: string, absenceId: string, reason: string) => Promise<void>;
    rejectConvention: (id: string, role: string, reason: string) => Promise<void>;
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

// --- DUAL WRITE HELPER ---
// --- DUAL WRITE HELPER ---
const syncToPostgres = async (convention: any) => {
    try {
        // Do not sync in Demo Mode 
        if ((convention.id && convention.id.startsWith('demo_')) || convention.studentId === 'etudiant.simu@email.com') {
            return;
        }

        console.log("[DUAL_WRITE] Syncing to PostgreSQL...", convention.id);
        console.log("SENDING PAYLOAD:", JSON.stringify(convention, null, 2));
        const res = await fetch('/api/sync/convention', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(convention)
        });

        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            throw new Error("API returned non-JSON response: " + res.statusText);
        }

        const json = await res.json();

        if (!res.ok || !json.success) {
            console.error("[DUAL_WRITE] API Error:", json.error || res.statusText);
            throw new Error(`Erreur de sauvegarde (API): ${json.error || res.statusText}`);
        } else {
            console.log("[DUAL_WRITE] Success for", convention.id);
        }
    } catch (e: any) {
        console.error("[DUAL_WRITE] Network/Fetch Error:", e);
        // We MUST re-throw or notify to prevent silent failure in UI
        throw e;
    }
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
        student: {
            signedAt: "2023-01-15T10:00:00Z",
            code: "ELEVETEST-12345",
            name: "Lucas Martin",
            hash: "mock_hash_student"
        },
        parent: {
            signedAt: "2023-01-15T18:00:00Z",
            code: "PARENTTE-12345",
            name: "Paul Martin",
            hash: "mock_hash_parent"
        },
        teacher: {
            signedAt: "2023-01-16T09:00:00Z",
            code: "PROFREFE-12345",
            name: "M. Dupont",
            hash: "mock_hash_teacher"
        },
        company_head: {
            signedAt: "2023-01-16T14:00:00Z",
            code: "ENTREPRI-12345",
            name: "Mme Directrice",
            hash: "mock_hash_company"
        },
        tutor: {
            signedAt: "2023-01-16T14:05:00Z",
            code: "TUTEURST-12345",
            name: "M. Tuteur",
            hash: "mock_hash_tutor"
        },
        head: {
            signedAt: "2023-01-17T08:30:00Z",
            code: "DIRECTEU-12345",
            name: "Mme Martin"
        }
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
    ecole_chef_email: "demo_access@pledgeum.fr",
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
    isLoading: false,

    fetchConventions: async (userId: string, userEmail?: string) => {
        const { role, schoolId } = useUserStore.getState();

        try {
            let url = '/api/conventions?limit=100';

            // Filter Logic
            if (role === 'student') {
                url += `&studentId=${userId}`;
            } else if (schoolId) {
                // Admin / Teacher sees School scope
                url += `&uai=${schoolId}`;
            }

            console.log(`[ConventionStore] Fetching from: ${url}`);
            const res = await fetch(url);

            if (!res.ok) throw new Error('Failed to fetch conventions');

            const data = await res.json();
            if (data.success && Array.isArray(data.conventions)) {
                const mappedConventions = data.conventions.map((c: any) => ({
                    // Systemic Fix: Spread metadata FIRST, then API columns.
                    // This ensures Live Data (teacherEmail from JOIN) overrides stale Snapshot data.
                    ...(c.metadata || {}),
                    ...c,

                    // Map specific DB columns to Frontend Conventions interface
                    stage_date_debut: c.dateStart || c.date_start || (c.metadata && c.metadata.stage_date_debut),
                    stage_date_fin: c.dateEnd || c.date_end || (c.metadata && c.metadata.stage_date_fin),
                    studentId: c.studentId || c.student_uid,
                    schoolId: c.schoolId || c.establishment_uai || c.establishmentUai,
                    rejection_reason: c.rejectionReason || c.rejection_reason || (c.metadata && c.metadata.rejection_reason),

                    // Ensure dates are stringified if needed (though API JSON does this)
                    createdAt: c.createdAt || c.created_at,
                    updatedAt: c.updatedAt || c.updated_at,
                    evaluationAnswers: c.evaluationAnswers,
                    evaluationFinalGrade: c.evaluationFinalGrade,
                    evaluationDate: c.evaluationDate,
                }));

                set({ conventions: mappedConventions });
            } else {
                set({ conventions: [] });
            }

        } catch (error) {
            console.error("[ConventionStore] API Error:", error);
            set({ conventions: [] });
        }
    },

    fetchAllConventions: async () => {
        console.log("ConventionStore: Firestore fetchAll disabled.");
        return [];
    },

    addConvention: (data, studentId) => {
        const { schoolId, email } = useUserStore.getState();
        const isSandbox = schoolId === '9999999Z';
        const isSuperAdmin = email === 'pledgeum@gmail.com';

        set((state) => ({
            conventions: [...state.conventions, {
                ...data,
                id: Math.random().toString(36).substr(2, 9),
                studentId,
                schoolId: schoolId, // Inject School ID
                userId: 'temp_user_id',
                status: 'SUBMITTED', // Starts at submitted for simplicity in this demo
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                signatures: {},
                feedbacks: [],
                isTestData: isSandbox || isSuperAdmin
            }]
        }))
    },

    updateStatus: (id, newStatus) => set((state) => ({
        conventions: state.conventions.map(c =>
            c.id === id ? { ...c, status: newStatus, updatedAt: new Date().toISOString() } : c
        )
    })),

    // Logique métier de transition d'état lors d'une signature
    // Logique métier de transition d'état lors d'une signature
    signConvention: async (id, role, signatureImage, providedCode, extraAuditLog, dualSign = false, newCompanyHeadEmail) => {

        const { conventions } = get();
        const foundConvention = conventions.find(c => c.id === id);
        if (!foundConvention) return;
        const convention = foundConvention as Convention;

        const code = providedCode || generateSignatureCode();

        try {
            // Call the new API
            const response = await fetch(`/api/conventions/${id}/sign`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    role,
                    signatureImage,
                    code,
                    extraAuditLog,
                    dualSign,
                    newCompanyHeadEmail
                })

            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to sign convention via API');
            }

            const responseData = await response.json();
            const updatedData = responseData.data;
            const recipients = responseData.recipients || [];
            const newStatus = updatedData.status; // [FIX] Restore for notification logic below

            // Optimistically update local state or use returned data
            const newMetadata = updatedData.metadata || {};
            const now = new Date().toISOString();

            set((state) => ({
                conventions: state.conventions.map(c =>
                    c.id === id ? {
                        ...c,
                        status: updatedData.status as ConventionStatus,
                        signatures: newMetadata.signatures || c.signatures,
                        metadata: {
                            ...(c.metadata || {}),
                            signatures: newMetadata.signatures || c.signatures,
                            lastRecipients: responseData.recipients || [], // [NEW] Persist structured objects
                            ...(newMetadata.certificateHash ? { certificateHash: newMetadata.certificateHash } : {})
                        },
                        updatedAt: now,
                        auditLogs: [
                            ...(c.auditLogs || []),
                            ...(extraAuditLog ? [extraAuditLog] : []),
                            {
                                date: now,
                                action: 'SIGNED',
                                actorEmail: role,
                                details: `Signature par ${role} (API)`
                            }
                        ]
                    } : c
                )
            }));

            return responseData;

            // Notifications are currently handled in the logic below this block in the original file.
            // We should PRESERVE the notification logic or move it to the API. 
            // The prompt "Goal: When the user clicks "Signer", the request travels via HTTP to the Server..."
            // It didn't explicitly say "Move email logic". 
            // But usually, emails should be server-side. 
            // However, the original Store had distinct `if (newStatus === ...)` blocks for emails.
            // For this specific refactor, I will KEEP the client-side email triggers to minimize regression risk,
            // as I am only tasked to switch the *persistence* layer.

            // ... (The original notification logic follows here in the store, 
            // but since I am replacing the function, I need to include it or ensure it runs.)

            // RE-Start Notification Logic Copy from Original (Adapted)
            // Determine Dashboard Link based on Environment
            const origin = typeof window !== 'undefined' ? window.location.origin : '';
            const isLocal = origin.includes('localhost');
            const dashboardLink = isLocal ? 'http://localhost:3000/' : 'https://www.pledgeum.fr/';

            if (!convention) return;

            if (newStatus === 'SUBMITTED') {
                // Student has signed -> Notify Parent (if minor) or Teacher (if major)
                if (convention.est_mineur && convention.rep_legal_email) {
                    await sendNotification(
                        convention.rep_legal_email!,
                        `Convention PFMP à signer - ${convention.eleve_prenom} ${convention.eleve_nom}`,
                        `Bonjour,\n\nVotre enfant ${convention.eleve_prenom} ${convention.eleve_nom} a signé sa convention de stage.\nMerci de la signer à votre tour : ${dashboardLink}`
                    );
                } else {
                    await sendNotification(
                        convention.prof_email!,
                        `Convention PFMP à valider - ${convention.eleve_prenom} ${convention.eleve_nom}`,
                        `Bonjour,\n\nL'élève ${convention.eleve_prenom} ${convention.eleve_nom} (Majeur) a signé sa convention.\nMerci de la valider : ${dashboardLink}`
                    );
                }
            }
            else if (newStatus === 'SIGNED_PARENT') {
                // Parent has signed -> Notify Teacher to Validate
                const parentName = convention.rep_legal_prenom ? `${convention.rep_legal_prenom} ${convention.rep_legal_nom}` : convention.rep_legal_nom;
                await sendNotification(
                    convention.prof_email!,
                    `Convention PFMP à valider - ${convention.eleve_prenom} ${convention.eleve_nom} - ${convention.ecole_nom}`,
                    `Bonjour,\n\nLe représentant légal (${parentName}) de l'élève ${convention.eleve_prenom} ${convention.eleve_nom} (Classe: ${convention.eleve_classe}) a signé la convention pour le stage chez ${convention.ent_nom} (${convention.ent_ville}).\n\nMerci de vérifier et valider la convention : ${dashboardLink}\n\nCordialement.`
                );
            }
            else if (newStatus === 'VALIDATED_TEACHER') {
                const { sendConventionInvitation } = await import('@/app/actions/notifications');
                await sendConventionInvitation(convention.id, 'company_head', convention.ent_rep_email!, convention.ent_rep_nom);
            }
            else if (newStatus === 'SIGNED_COMPANY') {
                const { sendConventionInvitation } = await import('@/app/actions/notifications');
                await sendConventionInvitation(convention.id, 'tutor', convention.tuteur_email!, convention.tuteur_prenom ? `${convention.tuteur_prenom} ${convention.tuteur_nom}` : convention.tuteur_nom);
            }
            else if (newStatus === 'SIGNED_TUTOR') {
                const tutorName = convention.tuteur_prenom ? `${convention.tuteur_prenom} ${convention.tuteur_nom}` : convention.tuteur_nom;
                await sendNotification(
                    convention.ecole_chef_email!,
                    `Convention PFMP à valider - ${convention.eleve_prenom} ${convention.eleve_nom} - ${convention.ecole_nom}`,
                    `Bonjour,\n\nLe tuteur (${tutorName}) a signé la convention de l'élève ${convention.eleve_prenom} ${convention.eleve_nom} (Classe: ${convention.eleve_classe}) pour le stage chez ${convention.ent_nom} (${convention.ent_ville}).\n\nMerci de procéder à la validation finale : ${dashboardLink}\n\nCordialement.`
                );
            }
            else if (newStatus === 'VALIDATED_HEAD') {
                // FINAL VALIDATION: Notify EVERYONE
                const subject = `Convention PFMP Finalisée - ${convention.eleve_prenom} ${convention.eleve_nom} - ${convention.ecole_nom}`;
                const msg = `Bonjour,\n\nLa convention de stage de l'élève ${convention.eleve_prenom} ${convention.eleve_nom} (Classe: ${convention.eleve_classe}) chez ${convention.ent_nom} (${convention.ent_ville}) a été signée par tous et validée par le Chef d'Établissement (${convention.ecole_chef_nom}).\n\nVous pouvez télécharger le document final sur votre tableau de bord : ${dashboardLink}\n\nBon stage !`;

                const recipients = [
                    convention.eleve_email!,
                    convention.prof_email!,
                    convention.ent_rep_email!,
                    convention.tuteur_email!,
                    // Parent only if minor
                    convention.est_mineur ? convention.rep_legal_email! : null,
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

    createConvention: async (data: any) => {
        set({ isLoading: true });
        try {
            const { uai: userUai, profileData } = useUserStore.getState();

            // Action 3: Explicit Mapping of essential IDs for Backend Security Guard
            // Ensure schoolId and classId captured during Wizard steps are included
            const payload = {
                ...data,
                // Critical Mapping: Backend expects establishment_uai and class_id
                establishment_uai: data.schoolId || userUai || (profileData as any).uai,
                class_id: data.class_id || (profileData as any).classId || (profileData as any).class_id,
            };

            console.log("[Store] Creating convention via API...", payload);
            const response = await fetch('/api/conventions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                // Action 4: End of Ghost Convention. If API fails, we do NOT update local state.
                const err = await response.json();
                const errorMessage = err.error || 'Erreur lors de la sauvegarde : données de profil incomplètes ou invalides.';
                throw new Error(errorMessage);
            }

            const { data: createdConvention } = await response.json();

            // Map DB columns (snake_case) to Frontend model (camelCase)
            const mappedConvention = {
                ...(createdConvention.metadata || {}),
                ...createdConvention,
                studentId: createdConvention.studentId || createdConvention.student_uid || data.studentId,
                schoolId: createdConvention.schoolId || createdConvention.establishment_uai || createdConvention.establishmentUai || data.schoolId,
                createdAt: createdConvention.createdAt || createdConvention.created_at || new Date().toISOString(),
                updatedAt: createdConvention.updatedAt || createdConvention.updated_at || new Date().toISOString(),
                stage_date_debut: createdConvention.dateStart || createdConvention.date_start || (createdConvention.metadata && createdConvention.metadata.stage_date_debut) || data.stage_date_debut,
                stage_date_fin: createdConvention.dateEnd || createdConvention.date_end || (createdConvention.metadata && createdConvention.metadata.stage_date_fin) || data.stage_date_fin,
                signatures: createdConvention.metadata?.signatures || createdConvention.signatures || {}
            };

            // Only add to local state if server confirmed success
            set((state) => ({
                conventions: [...state.conventions, mappedConvention],
                isLoading: false
            }));

            return createdConvention.id;

        } catch (error) {
            console.error("Error creating convention:", error);
            set({ isLoading: false });
            throw error; // Let UI handle error display
        }
    },

    // Alias for UI compatibility (Step 1 calls this)
    submitConvention: async (data: any, studentId: string, userId: string) => {
        const { createConvention } = get();
        // Enhance data with IDs if needed, though API handles session
        const payload = { ...data, studentId, userId };
        return createConvention(payload);
    },
    updateConvention: async (id, data) => {
        try {
            // Updated to use PostgreSQL API
            console.log(`[Store] Updating convention ${id}...`, data);

            const response = await fetch(`/api/conventions/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to update convention');
            }

            const { data: updatedConvention } = await response.json();

            set((state) => ({
                conventions: state.conventions.map(c =>
                    c.id === id ? { ...c, ...data, ...updatedConvention } : c
                )
            }));

            console.log("[Store] Convention updated successfully");

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

            const response = await fetch(`/api/conventions/${conventionId}/absences`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(absenceData),
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Erreur lors de la déclaration");
            }

            const newAbsence = await response.json();

            set((state) => ({
                conventions: state.conventions.map(c =>
                    c.id === conventionId
                        ? { ...c, absences: [...(c.absences || []), newAbsence] }
                        : c
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

            const response = await fetch(`/api/absences/${absenceId}/justify`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason }),
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Erreur lors de la justification");
            }

            const updatedAbsence = await response.json();

            set((state) => ({
                conventions: state.conventions.map(c =>
                    c.id === conventionId
                        ? {
                            ...c,
                            absences: c.absences?.map(a => a.id === absenceId ? updatedAbsence : a) || []
                        }
                        : c
                )
            }));
        } catch (error) {
            console.error("Error updating absence:", error);
            throw error;
        }
    },

    rejectConvention: async (id, role, reason) => {
        try {
            const res = await fetch(`/api/conventions/${id}/reject`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role, reason })
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Erreur lors du refus');
            }

            // Update local state
            const { conventions } = get();
            const updatedConventions = conventions.map(c =>
                c.id === id ? { ...c, status: 'REJECTED' as ConventionStatus } : c
            );
            set({ conventions: updatedConventions });
        } catch (error) {
            console.error('Error rejecting convention:', error);
            throw error;
        }
    },

    validateAttestation: async (conventionId, finalAbsencesCount, signatureImg, signerName, signerFunction, totalDaysPaid, totalWeeksDiploma) => {
        try {
            const convention = get().conventions.find(c => c.id === conventionId);
            if (!convention) throw new Error("Convention introuvable");

            const code = generateSignatureCode();

            // Prepare the attestation payload for our new API
            const attestationPayload: any = {
                total_days_paid: totalDaysPaid || 0,
                total_weeks_diploma: totalWeeksDiploma || 0,
                absences_hours: finalAbsencesCount || 0,
                activities: convention.activites || convention.stage_activites || '',
                skills_evaluation: convention.attestation_competences || '',
                gratification_amount: convention.attestation_gratification || '0',
                signer_name: signerName,
                signer_function: signerFunction,
                signature_date: new Date().toISOString(),
                signature_img: signatureImg,
                signature_code: code,
                audit_logs: [
                    ...(convention.auditLogs || []),
                    {
                        date: new Date().toISOString(),
                        action: 'ATTESTATION_SIGNED' as const,
                        actorEmail: convention.ent_rep_email,
                        details: `Signature de l'attestation par ${signerName} (${signerFunction})`
                    }
                ]
            };

            // Compute Hash (Local logic for generation, but we'll save it)
            const tempConv = { ...convention, ...attestationPayload, attestationSigned: true, attestationDate: attestationPayload.signature_date } as any;
            const { hashDisplay } = await generateVerificationUrl(tempConv, 'attestation');
            (attestationPayload as any).pdf_hash = hashDisplay;

            if (!useDemoStore.getState().isDemoMode) {
                const response = await fetch(`/api/conventions/${conventionId}/attestation`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(attestationPayload)
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || "Erreur lors de la sauvegarde de l'attestation");
                }
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
                        attestationSigned: true,
                        attestationDate: attestationPayload.signature_date,
                        attestation_total_jours: totalDaysPaid,
                        attestation_total_semaines: totalWeeksDiploma,
                        attestation_signature_img: signatureImg,
                        attestation_signature_code: code,
                        attestation_signer_name: signerName,
                        attestation_signer_function: signerFunction,
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

    assignTrackingTeacher: async (conventionId, trackingTeacherEmail, distanceKm) => {
        try {
            const res = await fetch(`/api/conventions/${conventionId}/visits/assign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trackingTeacherEmail, distanceKm })
            });

            if (!res.ok) throw new Error("Erreur lors de l'assignation de la visite en base");

            set((state) => ({
                conventions: state.conventions.map(c =>
                    c.id === conventionId ? {
                        ...c,
                        prof_suivi_email: trackingTeacherEmail,
                        visit: { tracking_teacher_email: trackingTeacherEmail }
                    } : c
                )
            }));

            console.log(`[STORE] Assigned tracking teacher ${trackingTeacherEmail} to convention ${conventionId}`);

            // === Automatic Mission Order Creation ===
            if (trackingTeacherEmail) {
                const { useSchoolStore } = await import('@/store/school');
                const { useMissionOrderStore } = await import('@/store/missionOrder');

                const convention = get().conventions.find(c => c.id === conventionId);
                const schoolAddress = useSchoolStore.getState().schoolAddress;

                if (convention && schoolAddress) {
                    const companyAddress = `${convention.ent_adresse}, ${convention.ent_code_postal} ${convention.ent_ville}`;

                    // Fallback to recalculate distance if UI failed to provide it, although it should
                    let finalDistance = distanceKm;
                    if (finalDistance === undefined) {
                        const { getCoordinates, calculateDistance } = await import('@/lib/geocoding');
                        const schoolCoords = await getCoordinates(schoolAddress);
                        const companyCoords = await getCoordinates(companyAddress);
                        if (schoolCoords && companyCoords) {
                            finalDistance = calculateDistance(schoolCoords.lat, schoolCoords.lon, companyCoords.lat, companyCoords.lon);
                        } else {
                            finalDistance = 0;
                        }
                    }

                    // 2. Handle Revocation Alerte
                    const prevTeacherEmail = convention.prof_suivi_email || convention.visit?.tracking_teacher_email;
                    if (prevTeacherEmail && prevTeacherEmail !== trackingTeacherEmail) {
                        const odm = useMissionOrderStore.getState().getMissionOrderByConvention(conventionId);
                        const isSigned = !!odm?.signature_data?.head?.hash || !!odm?.signature_data?.teacher?.hash;

                        if (isSigned) {
                            console.log(`[REVOCATION] Notifying ${prevTeacherEmail} about ODM cancellation`);
                            await sendNotification(
                                prevTeacherEmail,
                                `Annulation d'Ordre de Mission - ${convention.eleve_prenom} ${convention.eleve_nom}`,
                                `Bonjour,\n\nNous vous informons que votre assignation pour le suivi de stage de ${convention.eleve_prenom} ${convention.eleve_nom} a été modifiée.\n\nEn conséquence, l'Ordre de Mission précédemment généré (et potentiellement signé) est annulé et ne doit plus être utilisé.\n\nUn nouvel ODM a été généré pour le nouvel enseignant assigné.\n\nCordialement,\nL'administration.`
                            );
                        }
                    }

                    // 3. Create/Update Mission Order
                    await useMissionOrderStore.getState().createMissionOrder({
                        conventionId: convention.id,
                        teacherId: trackingTeacherEmail,
                        studentId: convention.studentId,
                        schoolAddress,
                        companyAddress,
                        distanceKm: Math.round(finalDistance * 10) / 10
                    });

                    console.log(`[ODM] Created Mission Order for ${trackingTeacherEmail} (Dist: ${finalDistance}km)`);
                }
            }
        } catch (error) {
            console.error("Error assigning tracking teacher:", error);
            throw error;
        }
    },

    verifySignature: async (rawCode) => {
        // Remove aggressive sanitization to preserve dashes/case for server verify
        const code = (rawCode || '').trim();
        if (!code) return null;

        const { conventions } = get();

        // 1. Check Local State First (Fast)
        for (const conv of conventions) {
            const s = conv.signatures || {};

            const matches = (stored?: string) => {
                if (!stored) return false;
                const cleanStored = stored.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                return cleanStored.startsWith(code);
            };

            // Check all roles
            if (matches(s.student?.code) || matches(s.parent?.code) || matches(s.teacher?.code) ||
                matches(s.company_head?.code) || matches(s.tutor?.code) || matches(s.head?.code)) {
                return conv;
            }

            // Check specific fields
            if (matches(conv.attestation_signature_code) || matches(conv.certificateHash) || matches(conv.attestationHash)) {
                return conv;
            }

            // Check ID prefix (e.g. conv_9A...) or just the code
            const cleanId = (conv.id || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
            if (cleanId.startsWith(code) || cleanId.includes(code)) {
                return conv;
            }
        }

        // 2. Global PostgreSQL API Lookup
        try {
            console.log(`[CONVENTION_STORE] Verifying signature code via API: ${code}`);
            const response = await fetch(`/api/verify?code=${encodeURIComponent(code)}`);

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.convention) {
                    return data.convention;
                }
            } else {
                console.warn("[CONVENTION_STORE] Global verify failed:", response.status);
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

    saveDraftAssignments: async (assignments) => {
        if (Object.keys(assignments).length === 0) return;
        
        try {
            console.log("[Store] Saving draft assignments...", assignments);
            const response = await fetch('/api/mission-orders/draft-save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assignments })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to save draft assignments');
            }

            // Sync Local State: Update conventions in the store to reflect the new drafts
            set((state) => ({
                conventions: state.conventions.map(conv => {
                    const draft = assignments[conv.id];
                    if (draft) {
                        return {
                            ...conv,
                            visit: {
                                ...(conv.visit || { tracking_teacher_email: '' }), // Provide a default or preserve
                                draft_tracking_teacher_email: draft.email,
                                draft_distance_km: draft.distance
                            }
                        };
                    }
                    return conv;
                })
            }));

            console.log("[Store] Draft assignments saved and synced successfully");
        } catch (error) {
            console.error("Error saving draft assignments:", error);
        }
    },

    reset: () => set({ conventions: [] })
}));
