'use client';

import { useState, useEffect, useRef, useMemo } from 'react';

import { StudentDocumentButton } from '@/components/ui/StudentDocumentButton';
import { WizardForm } from '@/components/wizard/WizardForm';
import { useUserStore, UserRole } from '@/store/user';
import { useWizardStore } from '@/store/wizard';
import { useConventionStore, Convention } from '@/store/convention';
import { useSchoolStore } from '@/store/school';
import { SignatureModal } from '@/components/ui/SignatureModal';
import { SignatureTimeline } from '@/components/ui/SignatureTimeline';
import { CompanySearchModal } from '@/components/ui/CompanySearchModal';
import { pdfService } from '@/services/pdfService';
import { ProfileModal } from '@/components/ui/ProfileModal';
import { ParentValidationModal } from '@/components/ui/ParentValidationModal';
import { TutorValidationModal } from '@/components/conventions/modals/TutorValidationModal';
import { CompanyValidationModal } from '@/components/conventions/modals/CompanyValidationModal';
import { SchoolHeadValidationModal } from '@/components/conventions/modals/SchoolHeadValidationModal';

import {
  FileText, LogOut, Plus, Trash2, Loader2, AlertCircle, CheckCircle,
  Menu, X, Calendar, MapPin, Building, User, Mail, Phone, ExternalLink,
  ShieldCheck, MessageSquare, Settings, UserCircle, AlertTriangle, Search,
  Briefcase, Send, Eye, PenTool, UserPlus, Users, Bell, Shield, Building2, Clock, ClipboardList, FileSpreadsheet, BarChart3, CalendarX, BookOpen, PhoneCall
} from 'lucide-react';
import { useSession, signOut } from "next-auth/react";
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { SignatureVerificationModal } from '@/components/ui/SignatureVerificationModal';
import { useMissionOrderStore, isOdmPendingForHead, MissionOrder } from '@/store/missionOrder';


import { useAdminStore } from '@/store/admin';
import { useDocumentStore } from '@/store/documents';
import { ConventionStatusBadge } from '@/components/conventions/ConventionStatusBadge';
import { ConventionActions } from '@/components/conventions/ConventionActions';
import QRCode from 'qrcode';
import { generateVerificationUrl } from '@/app/actions/sign';

// Dynamic import of the Preview component to isolate PDF logic and avoid SSR/build issues
const PdfPreview = dynamic(() => import('@/components/pdf/PdfPreview'), {
  ssr: false,
  loading: () => <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"><div className="bg-white p-4 rounded shadow">Chargement de l'aperçu...</div></div>
});

import { MissionOrderPdf } from '@/components/pdf/MissionOrderPdf';

const PdfRenderer = dynamic(() => import('@/components/ui/PdfRenderer').then(m => m.PdfRenderer), { ssr: false });

const SchoolAdminModal = dynamic(() => import('@/components/admin/SchoolAdminModal').then(m => m.SchoolAdminModal), { ssr: false });
const SchoolAdminPanelSection = dynamic(() => import('@/components/admin/sections/SchoolAdminPanelSection').then(m => m.SchoolAdminPanelSection), { ssr: false });
const InternshipProgressChart = dynamic(() => import('@/components/dashboard/analytics/InternshipProgressChart'), { ssr: false });
const SuperAdminModal = dynamic(() => import('@/components/admin/SuperAdminModal').then(m => m.SuperAdminModal), { ssr: false });
const FeedbackModal = dynamic(() => import('@/components/ui/FeedbackModal').then(m => m.FeedbackModal), { ssr: false });
const TosModal = dynamic(() => import('@/components/ui/TosModal').then(m => m.TosModal), { ssr: false });
const DeleteAccountModal = dynamic(() => import('@/components/ui/DeleteAccountModal').then(m => m.DeleteAccountModal), { ssr: false });
const AbsenceReportModal = dynamic(() => import('@/components/ui/AbsenceReportModal').then(m => m.AbsenceReportModal), { ssr: false });
const AttestationModal = dynamic(() => import('@/components/ui/AttestationModal').then(m => m.AttestationModal), { ssr: false });
const MissionOrderModal = dynamic(() => import('@/components/admin/MissionOrderModal').then(m => m.MissionOrderModal), { ssr: false });
const ContactSchoolModal = dynamic(() => import('@/components/ui/ContactSchoolModal').then(m => m.ContactSchoolModal), { ssr: false });
const ContactCompanyModal = dynamic(() => import('@/components/ui/ContactCompanyModal').then(m => m.ContactCompanyModal), { ssr: false });
const AlumniModal = dynamic(() => import('@/components/ui/AlumniModal').then(m => m.AlumniModal), { ssr: false });
const TrackingMatrixModal = dynamic(() => import('@/components/ui/TrackingMatrixModal').then(m => m.TrackingMatrixModal), { ssr: false });
const ClassDocumentModal = dynamic(() => import('@/components/ui/ClassDocumentModal').then(m => m.ClassDocumentModal), { ssr: false });
const StudentDocumentModal = dynamic(() => import('@/components/ui/StudentDocumentModal').then(m => m.StudentDocumentModal), { ssr: false });
const EmailCorrectionModal = dynamic(() => import('@/components/ui/EmailCorrectionModal').then(m => m.EmailCorrectionModal), { ssr: false });
const TrackingAssignmentModal = dynamic(() => import('@/components/ui/TrackingAssignmentModal'), { ssr: false });
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { Files as FilesIcon } from 'lucide-react';

// 🛡️ HARD GUARD: Verrou persistant pour l'hydratation des classes (survit aux remounts)
const GLOBAL_HIDRATED_CLASSES = new Set<string>();

// Helper for Admin Roles
const isSchoolAdminRole = (r: UserRole) => {
  return r === 'school_head' || r === 'ddfpt' || r === 'business_manager' || r === 'assistant_manager' || r === 'stewardship_secretary' || r === 'cpe' || r === 'school_life' || r === 'at_ddfpt' || r === 'ESTABLISHMENT_ADMIN' || r === 'SUPER_ADMIN';
};

// Helper for High Level Admin (Management Access)
const isHighLevelAdmin = (r: UserRole | string) => {
  return r === 'ESTABLISHMENT_ADMIN' || r === 'school_head' || r === 'ddfpt' || r === 'DDFPT' || r === 'SUPER_ADMIN';
};

// Helper for Filter Access (includes Admin Roles + Teachers + AT DDFPT)
const hasFilterAccess = (r: UserRole) => {
  return isSchoolAdminRole(r) || r === 'teacher' || r === 'teacher_tracker' || r === 'company_head' || r === 'tutor' || r === 'company_head_tutor';
};

export default function Home() {
  const { data: session, status } = useSession();
  const loading = status === "loading";
  const user = session?.user;
  const router = useRouter();
  const { role: storeRole, notifications, unreadCount, markAsRead, clearNotifications, addNotification, fetchUserProfile, profileData, trackConnection, anonymizeAccount } = useUserStore();

  // Determine effective role (Priority: Session > Store)
  let initialRole = ((session?.user as any)?.role || storeRole) as string;
  // Fix for DDFPT uppercase case (if coming from session/claims)
  if (initialRole === 'DDFPT') initialRole = 'ddfpt';
  const role = initialRole as UserRole;
  const { getConventionsByRole, fetchConventions, signConvention } = useConventionStore();
  const { isSchoolAuthorized } = useAdminStore();
  const [isRgpdModalOpen, setIsRgpdModalOpen] = useState(false);

  const resetWizard = useWizardStore((state) => state.reset);
  const [showWizard, setShowWizard] = useState(false);

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSchoolAdminModalOpen, setIsSchoolAdminModalOpen] = useState(false);
  const [isMissionOrderModalOpen, setIsMissionOrderModalOpen] = useState(false);
  const [isAlumniModalOpen, setIsAlumniModalOpen] = useState(false);
  const [isSuperAdminModalOpen, setIsSuperAdminModalOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [verificationConvention, setVerificationConvention] = useState<Convention | null>(null);

  const [isVerificationPdfOpen, setIsVerificationPdfOpen] = useState(false);
  const [isVerificationAttestationOpen, setIsVerificationAttestationOpen] = useState(false);
  const [allConventions, setAllConventions] = useState<Convention[]>([]); // For search functionality
  const { fetchAllConventions } = useConventionStore();

  // --- REORDERABLE SECTIONS LOGIC (SSR-Safe) ---
  const DEFAULT_ORDER = ['admin', 'progress', 'conventions'];
  const [sectionsOrder, setSectionsOrder] = useState<string[]>(DEFAULT_ORDER);

  // Hydration effect for LocalStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('dashboard_sections_order');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSectionsOrder(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load sections order", e);
    }
  }, []);

  const moveSection = (id: string, direction: 'up' | 'down') => {
    const currentIndex = sectionsOrder.indexOf(id);
    if (currentIndex === -1) return;
    
    const newOrder = [...sectionsOrder];
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    if (newIndex < 0 || newIndex >= newOrder.length) return;
    
    // Swap
    [newOrder[currentIndex], newOrder[newIndex]] = [newOrder[newIndex], newOrder[currentIndex]];
    
    setSectionsOrder(newOrder);
    try {
      localStorage.setItem('dashboard_sections_order', JSON.stringify(newOrder));
    } catch (e) {
      console.error("Failed to save sections order", e);
    }
  };

  // DEBUG: Track Mount/Unmount
  useEffect(() => {
    console.log("Home Component MOUNTED");
    return () => console.log("Home Component UNMOUNTED");
  }, []);



  const { classes } = useSchoolStore();
  
  // Calculate Classes for Teacher View Filtering
  const displayClassIds = useMemo(() => {
    const currentRole = role?.toLowerCase();
    if (isHighLevelAdmin(role)) return null; // Admin sees all
    if (['teacher', 'teacher_tracker', 'main_teacher'].includes(currentRole)) {
      const userEmail = user?.email?.toLowerCase();
      return classes
        .filter(c => {
          const mainTeacherEmail = c.mainTeacher?.email?.toLowerCase();
          return mainTeacherEmail === userEmail || 
                 c.teachersList?.some(t => t.email?.toLowerCase() === userEmail);
        })
        .map(c => c.id);
    }
    return [];
  }, [role, classes, user?.email]);

  const showProgressChart = isHighLevelAdmin(role) || 
                           ['teacher', 'teacher_tracker', 'main_teacher'].includes(role?.toLowerCase());

  const [isTrackingMatrixOpen, setIsTrackingMatrixOpen] = useState(false);
  const [isClassDocModalOpen, setIsClassDocModalOpen] = useState(false);
  const [studentDocModalClassId, setStudentDocModalClassId] = useState<string | null>(null); // New state
  const [isChildModalOpen, setIsChildModalOpen] = useState(false);
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isContactCompanyModalOpen, setIsContactCompanyModalOpen] = useState(false);
  const [selectedConventionId, setSelectedConventionId] = useState<string | null>(null);

  const isAnyModalOpen = useMemo(() => {
    return (
      isProfileModalOpen || isSearchModalOpen || isSchoolAdminModalOpen || 
      isMissionOrderModalOpen || isAlumniModalOpen || isSuperAdminModalOpen || 
      isFeedbackModalOpen || isDeleteModalOpen || isVerificationModalOpen || 
      isClassDocModalOpen || isTrackingMatrixOpen || isRgpdModalOpen || 
      isChildModalOpen || isAbsenceModalOpen || isContactModalOpen || 
      isContactCompanyModalOpen
    );
  }, [
    isProfileModalOpen, isSearchModalOpen, isSchoolAdminModalOpen, 
    isMissionOrderModalOpen, isAlumniModalOpen, isSuperAdminModalOpen, 
    isFeedbackModalOpen, isDeleteModalOpen, isVerificationModalOpen, 
    isClassDocModalOpen, isTrackingMatrixOpen, isRgpdModalOpen, 
    isChildModalOpen, isAbsenceModalOpen, isContactModalOpen, 
    isContactCompanyModalOpen
  ]);



  // Helper to check profile completion
  const isProfileComplete = () => {
    if (!role) return true;
    const required: string[] = [];

    // Core fields for everyone
    // required.push('firstName', 'lastName', 'email'); // Usually present from auth/creation

    // Super Admin Exemption
    if (user?.email === 'pledgeum@gmail.com') return true;

    if (role === 'student') {
      // Check basic info
      const basic = ['firstName', 'lastName', 'email', 'birthDate', 'schoolName'].every(f => profileData?.[f]);

      // Check Contact (Legacy flat vs New Object)
      // New onboarding saves 'address' as object {street, city, postalCode} and 'phone'
      // Old might correspond to flat fields? Let's check what we have.
      // Actually, let's look at what is ACTUALLY saved.
      // New: phone, address (object), legalRepresentatives (array)
      // Old: phone, address (string), zipCode, city, parentName...

      const hasContact = (
        (profileData?.address && typeof profileData.address === 'object') ||
        (profileData?.address && profileData.zipCode && profileData.city)
      );

      // Check Parent (Only mandatory for minors)
      const isMinor = (() => {
        if (!profileData?.birthDate) return true; // Assume minor if no birth date to be safe/force completion
        const birth = new Date(profileData.birthDate);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
          age--;
        }
        return age < 18;
      })();

      // Parent Check (Mandatory for ALL students)
      // We must check if the representative INSIDE the array actually has data.
      // Merely having an entry (which might be {role: '...'}) is not enough.
      const hasParent = (
        (
          profileData?.legalRepresentatives &&
          Array.isArray(profileData.legalRepresentatives) &&
          profileData.legalRepresentatives.length > 0 &&
          (profileData.legalRepresentatives[0].lastName || profileData.legalRepresentatives[0].firstName) &&
          (
            // Check address - typically stored as object in rep
            (profileData.legalRepresentatives[0].address && profileData.legalRepresentatives[0].address.street && profileData.legalRepresentatives[0].address.postalCode && profileData.legalRepresentatives[0].address.city)
          )
        ) ||
        (
          // Legacy flat fields check
          profileData?.parentName &&
          profileData?.parentAddress &&
          profileData?.parentZip &&
          profileData?.parentCity
        )
      );

      // Debug Profile Completion
      // Debug Profile Completion
      const missingBasic = ['firstName', 'lastName', 'email', 'birthDate', 'schoolName'].filter(f => !profileData?.[f]);
      if (missingBasic.length > 0) {
        console.group("Profile Incomplete - Basic Details");
        console.log("Missing Fields:", missingBasic);
        console.log("Current Profile Data:", profileData);
        console.groupEnd();
      }

      if (!basic) console.log("Profile Incomplete - Basic Failed");
      if (!hasContact) {
        console.group("Profile Incomplete - Contact Details");
        console.log("Start checking address...");
        console.log("Address (Object):", typeof profileData?.address === 'object' ? profileData.address : 'N/A');
        console.log("Address (Flat):", { street: profileData?.address, zip: profileData?.zipCode, city: profileData?.city });
        console.groupEnd();
      }
      if (!hasParent) {
        console.group("Profile Incomplete - Parent Details");
        console.log("Legal Representatives Array:", profileData?.legalRepresentatives);
        console.log("Has Parent Boolean:", hasParent);
        if (profileData?.legalRepresentatives && profileData?.legalRepresentatives?.length > 0) {
          console.log("First Rep:", profileData.legalRepresentatives[0]);
          console.log("First Rep Address:", profileData.legalRepresentatives[0]?.address);
        }
        console.groupEnd();
      }

      // Parent is required for ALL students
      return basic && hasContact && hasParent;
    }

    switch (role) {
      case 'company_head':
      case 'company_head_tutor': required.push('firstName', 'lastName', 'email', 'phone', 'companyName', 'siret', 'address', 'function'); break;
      case 'tutor': required.push('firstName', 'lastName', 'email', 'function', 'phone'); break;
      case 'parent': required.push('firstName', 'lastName', 'email', 'address', 'phone'); break;
      case 'teacher':
      case 'teacher_tracker': required.push('firstName', 'lastName', 'email', 'phone'); break;
      default: return true;
    }
    return required.every(field => profileData?.[field] && String(profileData[field]).trim() !== '');
  };

  // Helper to get specific missing fields for feedback
  const getMissingProfileFields = () => {
    if (!role) return [];
    if (user?.email === 'pledgeum@gmail.com') return [];

    const missing: string[] = [];
    const data = profileData || {};

    if (role === 'student') {
      if (!data.firstName) missing.push("Prénom");
      if (!data.lastName) missing.push("Nom");
      if (!data.birthDate) missing.push("Date de naissance");

      // Address check
      if (!data.address || (typeof data.address === 'object' && !data.address.street) || (!data.zipCode) || (!data.city)) {
        missing.push("Adresse complète (Rue, Ville, CP)");
      }

      // Parent Check (Mandatory for ALL students)
      const hasParent = (
        (
          data.legalRepresentatives?.length > 0 &&
          (data.legalRepresentatives[0].lastName || data.legalRepresentatives[0].firstName) &&
          (data.legalRepresentatives[0].address?.street && data.legalRepresentatives[0].address?.postalCode && data.legalRepresentatives[0].address?.city)
        ) ||
        (
          data.parentName && data.parentAddress && data.parentZip && data.parentCity
        )
      );
      if (!hasParent) missing.push("Responsable Légal (Nom et Adresse complète requis)");
    }
    // Add other roles if needed later
    return missing;
  };

  useEffect(() => {
    // Fetch data for search aggregation
    if (isSearchModalOpen && allConventions.length === 0) {
      fetchAllConventions().then(setAllConventions);
    }
  }, [isSearchModalOpen, fetchAllConventions, allConventions.length]);
  // Dual Role Logic
  const [dualRoleView, setDualRoleView] = useState<'company_head' | 'tutor'>('company_head');

  const [hasDismissedProfileModal, setHasDismissedProfileModal] = useState(false);

  // Profile Enforcement Disabled as per user request
  // The modal will no longer auto-open.

  // Ref to track if we've already initialized data for the current user
  const initializedUserRef = useRef<string | null>(null);

  // Hydrate School Data (Classes, Teachers) for the Matrix and Admin tools
  const { fetchSchoolData, classes: schoolClasses } = useSchoolStore();
  const uai = useUserStore(state => state.uai || state.schoolId);

  useEffect(() => {
    if (user && uai && (isSchoolAdminRole(role) || role === 'teacher' || role === 'teacher_tracker')) {
      // Avoid redundant fetches if classes are already loaded for this school (simple check)
      // Note: In a real app we might check if they belong to current UAI
      if (schoolClasses.length === 0) {
        console.log("[Home] Hydrating School Data for UAI:", uai);
        fetchSchoolData(uai);
      }
    }
  }, [user, uai, role, schoolClasses.length, fetchSchoolData]);

  useEffect(() => {
    async function checkProfile() {
      if (user) {
        // Prevent double-init for the same user
        if (initializedUserRef.current === (user.id || '')) {
          return;
        }
        initializedUserRef.current = (user.id || '');

        // ProfileFetch is handled by ProfileGuard. We do not need to fetch again to avoid infinite loops.
        // We only trigger side effects here (Conventions, Notifications, Tracking).

        trackConnection((user.id || ''));
        fetchConventions((user.id || ''), user.email || undefined);
        if (user.email) {
          useUserStore.getState().fetchNotifications(user.email);
        }
      }
    }

    if (!loading && !user) {
      router.push('/login');
    } else if (user) {
      // Logic for user presence
      checkProfile();
    }
  }, [user, loading, router, fetchConventions]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-500">Redirection vers la connexion...</p>
        </div>
      </div>
    );
  }

  const handleNewConvention = () => {
    const missing = getMissingProfileFields();
    if (!isProfileComplete()) {
      // Use the missing list if available (mostly implemented for student for now)
      if (missing.length > 0) {
        alert(`Veuillez compléter les informations suivantes dans votre profil :\n\n- ${missing.join('\n- ')}`);
      } else {
        alert("Veuillez compléter votre profil pour créer une convention.");
      }
      setIsProfileModalOpen(true);
      return;
    }
    resetWizard();
    setShowWizard(true);
  };

  const handleConfirmDeleteAccount = async () => {
    if (!user) return;

    // Check for Super Admin Protection
    if (user.email === 'pledgeum@gmail.com') {
      alert("MODE SIMULATION : Compte Super Admin protégé.\n\nLe processus de suppression a été simulé avec succès, mais aucune donnée n'a été effacée pour ce compte de test.");
      return;
    }

    try {
      await anonymizeAccount((user.id || ''));
      await signOut();
      window.location.href = '/';
    } catch (error) {
      console.error("Error deleting account:", error);
      alert("Une erreur est survenue lors de la suppression du compte.");
    }
  };





  const effectiveRole = role === 'company_head_tutor' ? dualRoleView : role;



  const roleLabels: Record<UserRole, string> = {
    student: 'Élève',
    teacher: 'Enseignant Référent/Professeur Principal',
    school_head: 'Chef d\'Établissement scolaire',
    company_head: 'Chef d\'Entreprise',
    tutor: 'Tuteur de Stage',
    parent: 'Représentant Légal (Parent)',
    company_head_tutor: 'Chef d\'Entreprise & Tuteur',
    ddfpt: 'DDFPT',
    business_manager: 'Resp. Bureau des Entreprises',
    assistant_manager: 'Adjoint Gestionnaire',
    stewardship_secretary: 'Secrétaire d\'Intendance',
    teacher_tracker: 'Enseignant référent chargé du suivi',
    at_ddfpt: 'Assistant(e) Technique DDFPT',
    cpe: 'CPE',
    school_life: 'Vie Scolaire',
    ESTABLISHMENT_ADMIN: 'Administrateur d\'Établissement',
    SUPER_ADMIN: 'Super Administrateur'
  };



  if (showWizard && role === 'student') {
    return (
      <div>
        <button
          onClick={() => setShowWizard(false)}
          className="fixed top-4 left-4 z-50 bg-white px-3 py-1 rounded-md shadow text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          ← Retour au tableau de bord
        </button>
        <WizardForm onSuccess={() => setShowWizard(false)} />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header / User Bar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          {/* 4. Wrap user info div in a button */}
          <div className="flex items-center gap-4">
            {/* App Branding */}
            <div className="hidden md:flex flex-col">
              <span className="text-lg font-bold text-indigo-900 leading-tight">Pledgeum</span>
              <span className="text-[10px] text-gray-500 font-medium -mt-1">Mon bureau des entreprises</span>
            </div>

            {/* User Profile Button */}
            <button
              onClick={() => setIsProfileModalOpen(true)}
              className="flex items-center space-x-3 p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer group"
              title={!isProfileComplete() ? "Profil incomplet - Cliquez pour compléter" : "Voir ou modifier mon profil"}
            >
              <div className="bg-blue-100 p-2 rounded-full group-hover:bg-blue-200 transition-colors relative">
                <UserCircle className="w-6 h-6 text-blue-600 group-hover:text-blue-700" />
                {!isProfileComplete() && (
                  <span className="absolute -top-0.5 -right-0.5 block h-3 w-3 rounded-full ring-2 ring-white bg-red-500 animate-pulse shadow-sm" />
                )}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-bold text-gray-900 group-hover:text-blue-700 transition-colors">
                  {profileData?.firstName ? `${profileData.firstName} ${profileData.lastName || ''}` : (user.name || user.email?.split('@')[0])}
                </p>
                <p className="text-xs text-gray-500 group-hover:text-blue-500 transition-colors">{user.email}</p>
              </div>
            </button>
          </div>

          {/* HAMBURGER BUTTON (Mobile Only) */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 -mr-2 rounded-md text-gray-500 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
            >
              <span className="sr-only">Open menu</span>
              {isMobileMenuOpen ? (
                <LogOut className="block h-6 w-6 transform rotate-180" aria-hidden="true" />
              ) : (
                <Menu className="block h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>

          {/* DESKTOP ACTIONS */}
          <div className="hidden md:flex items-center space-x-6">
            {/* Global Company Search Trigger - Restricted for Companies/Tutors */}
            {!['company_head', 'tutor', 'company_head_tutor'].includes(role) && (
              <button
                onClick={() => setIsSearchModalOpen(true)}
                className="flex items-center text-gray-500 hover:text-blue-600 transition-colors text-xs font-bold"
                title="Rechercher une entreprise partenaire"
              >
                <Building2 className="w-4 h-4 mr-1" />
                <span className="hidden xl:inline">Trouver une entreprise</span>
              </button>
            )}

            <button
              onClick={() => setIsRgpdModalOpen(true)}
              className="flex items-center text-gray-500 hover:text-blue-600 transition-colors text-xs font-bold"
              title="Consulter les engagements RGPD"
            >
              <ShieldCheck className="w-4 h-4 mr-1" />
              <span className="hidden xl:inline">Respect RGPD</span>
            </button>

            <button
              onClick={() => setIsVerificationModalOpen(true)}
              className="flex items-center text-gray-500 hover:text-blue-600 transition-colors text-xs font-bold"
              title="Scanner un QR Code pour vérifier un document"
            >
              <div className="bg-blue-50 text-blue-600 p-1.5 rounded-lg mr-2">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span className="hidden xl:inline">Authentification des documents</span>
            </button>

            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="flex items-center text-gray-400 hover:text-red-600 transition-colors"
              title="Supprimer mon compte (Droit à l'oubli)"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            {/* Feedback for Staff and Super Admin */}
            {(role === 'teacher' || isSchoolAdminRole(role) || user?.email?.toLowerCase() === 'pledgeum@gmail.com') && (
              <button
                onClick={() => setIsFeedbackModalOpen(true)}
                className="flex items-center text-gray-500 hover:text-blue-600 transition-colors mr-2 p-2 hover:bg-blue-50 rounded-full"
                title="Suggérer une amélioration ou signaler un problème"
              >
                <MessageSquare className="w-5 h-5" />
              </button>
            )}

            {/* Mission Orders - Admin OR Test Account Validation Access */}
            {(isSchoolAdminRole(role) || (user?.email?.toLowerCase() === 'pledgeum@gmail.com' && role === 'teacher_tracker')) && (
              <button
                onClick={() => setIsMissionOrderModalOpen(true)}
                className="flex items-center text-gray-500 hover:text-green-600 transition-colors text-xs font-bold mr-4"
                title="Gérer les signatures des Ordres de Mission"
              >
                <div className="bg-green-50 text-green-600 p-1.5 rounded-lg mr-2">
                  <FileText className="w-4 h-4" />
                </div>
                <span className="hidden xl:inline">Ordres de Mission</span>
                {useMissionOrderStore.getState().missionOrders.filter(isOdmPendingForHead).length > 0 && (
                  <span className="ml-2 bg-green-600 text-white text-[9px] px-1.5 py-0.5 rounded-full">
                    {useMissionOrderStore.getState().missionOrders.filter(isOdmPendingForHead).length}
                  </span>
                )}
              </button>
            )}

            {(role === 'school_head' || role === 'ddfpt' || role === 'at_ddfpt' || role === 'business_manager' || role === 'ESTABLISHMENT_ADMIN') && (
              <div className="flex items-center gap-2">
                {/* Alumni Button - Conditioned on authorization */}
                {(isSchoolAuthorized(profileData?.ecole_nom || getConventionsByRole('school_head', user.email || '', (user.id || ''))[0]?.ecole_nom || '') || user?.email?.toLowerCase() === 'pledgeum@gmail.com') && (
                  <button
                    onClick={() => setIsAlumniModalOpen(true)}
                    className="hidden md:flex items-center text-gray-500 hover:text-indigo-600 transition-colors text-xs font-bold mr-4"
                    title="Accéder au réseau des anciens élèves"
                  >
                    <div className="bg-indigo-50 text-indigo-600 p-1.5 rounded-lg mr-2">
                      <span className="text-sm">🎓</span>
                    </div>
                    <span className="hidden xl:inline">Alumni</span>
                  </button>
                )}

                <button
                  onClick={() => setIsSchoolAdminModalOpen(true)}
                  className="flex items-center text-gray-500 hover:text-blue-600 transition-colors text-xs font-bold"
                  title="Gérer les classes et le vivier d'enseignants pour le suivi"
                >
                  <div className="bg-blue-50 text-blue-600 p-1.5 rounded-lg mr-2">
                    <Users className="w-4 h-4" />
                  </div>
                  <span className="hidden xl:inline">Admin. Établissement</span>
                </button>
              </div>
            )}

            {/* SUPER ADMIN ROLE BOOSTER & ACCESS */}
            {(role === 'SUPER_ADMIN' || user?.email?.toLowerCase() === 'pledgeum@gmail.com') && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsSuperAdminModalOpen(true)}
                  className="flex items-center px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-sm h-[34px]"
                >
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  <span className="text-sm font-bold">S-Admin</span>
                </button>
                <div className="flex items-center space-x-2 bg-purple-100 p-1 rounded-lg border border-purple-200">
                  <span className="text-xs font-bold text-purple-700 ml-2">DEV MODE:</span>
                  <select
                    value={role || ''}
                    onChange={(e) => useUserStore.getState().setRole(e.target.value as UserRole)}
                    className="bg-purple-50 text-xs font-medium text-purple-900 border-none rounded focus:ring-purple-500 py-1"
                  >
                    <option value="student">Elève ou étudiant</option>
                    <option value="parent">Parent, responsable légal</option>
                    <option value="teacher">Enseignant référent (Professeur principal)</option>
                    <option value="teacher_tracker">Enseignant référent chargé du suivi</option>
                    <option value="company_head">Chef d'entreprise ou d'organisme d'accueil</option>
                    <option value="tutor">Tuteur dans l'organisme d'accueil</option>
                    <option value="school_head">Chef d'établissement scolaire</option>
                    <option value="ddfpt">Directeur Délégué à la Formation</option>
                    <option value="business_manager">Responsable du bureau des entreprises</option>
                    <option value="assistant_manager">Adjoint gestionnaire</option>
                    <option value="stewardship_secretary">Secrétaire d'intendance</option>
                    <option value="at_ddfpt">Assistant(e) Technique DDFPT</option>
                    <option value="cpe">CPE</option>
                    <option value="school_life">Vie Scolaire</option>
                  </select>
                </div>
              </div>
            )}

            <button
              onClick={() => signOut()}
              className="text-gray-500 hover:text-red-600 p-2 rounded-full hover:bg-gray-100 transition-colors"
              title="Se déconnecter"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
          {/* Notification Bell */}
          <div className="relative shrink-0 ml-4">
            <button
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className="p-1 rounded-full text-gray-500 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <span className="sr-only">Voir les notifications</span>
              <Bell className="w-6 h-6" />
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-white bg-red-500" />
              )}
            </button>

            {/* Notification Dropdown */}
            {isNotifOpen && (
              <div className="origin-top-right absolute right-0 mt-2 w-80 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50 focus:outline-none">
                <div className="py-1">
                  <div className="px-4 py-2 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="text-xs text-blue-600 font-medium">{unreadCount} non lues</span>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="px-4 py-4 text-sm text-gray-500 text-center">Aucune notification.</p>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif.id}
                          className={`px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 ${!notif.read ? 'bg-blue-50' : ''}`}
                          onClick={() => {
                            markAsRead(notif.id);
                            if (!notif.read && unreadCount === 1) {
                              setIsNotifOpen(false);
                            }
                          }}
                        >
                          <div className="flex justify-between items-start">
                            <p className={`text-sm font-medium ${!notif.read ? 'text-blue-900' : 'text-gray-900'}`}>{notif.title}</p>
                            {!notif.read && <span className="h-2 w-2 rounded-full bg-blue-600 mt-1"></span>}
                          </div>
                          <p className="text-sm text-gray-500 mt-1">{notif.message}</p>
                          {notif.actionLabel && (
                            <button className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center">
                              {notif.actionLabel} →
                            </button>
                          )}
                          <p className="text-[10px] text-gray-500 mt-2 text-right">
                            {new Date(notif.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {role === 'company_head_tutor' ? (
            <div className="flex items-center space-x-3 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setDualRoleView('company_head')}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${dualRoleView === 'company_head'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                Vue Chef
              </button>
              <button
                onClick={() => setDualRoleView('tutor')}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${dualRoleView === 'tutor'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                Vue Tuteur
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <div className="flex items-center bg-blue-50 rounded-lg px-3 py-1 border border-blue-100">
                <Shield className="w-4 h-4 text-blue-600 mr-2" />
                <span className="text-sm font-medium text-blue-800">{roleLabels[role]}</span>
              </div>
            </div>
          )}


        </div>
      </header>
      {/* MOBILE MENU DROPDOWN */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed top-16 left-0 right-0 z-50 border-b border-gray-200 bg-white shadow-xl max-h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {/* User Info Mobile */}
            <div className="px-3 py-2 flex items-center space-x-3 mb-2 border-b border-gray-100">
              <div className="bg-blue-100 p-2 rounded-full">
                <UserCircle className="w-5 h-5 text-blue-600" />
              </div>
              <div className="truncate">
                <p className="text-sm font-bold text-gray-900">
                  {profileData?.firstName ? `${profileData.firstName} ${profileData.lastName || ''}` : (user.name || user.email)}
                </p>
                <p className="text-xs text-gray-500">{roleLabels[role]}</p>
              </div>
            </div>

            {!['company_head', 'tutor', 'company_head_tutor'].includes(role) && (
              <button
                onClick={() => { setIsSearchModalOpen(true); setIsMobileMenuOpen(false); }}
                className="block w-full text-left px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-blue-700 hover:bg-gray-50"
              >
                <div className="flex items-center">
                  <Building2 className="w-4 h-4 mr-2" />
                  Trouver une entreprise
                </div>
              </button>
            )}

            <button
              onClick={() => { setIsRgpdModalOpen(true); setIsMobileMenuOpen(false); }}
              className="block w-full text-left px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-blue-700 hover:bg-gray-50"
            >
              <div className="flex items-center">
                <ShieldCheck className="w-4 h-4 mr-2" />
                Respect RGPD
              </div>
            </button>

            <button
              onClick={() => { setIsVerificationModalOpen(true); setIsMobileMenuOpen(false); }}
              className="block w-full text-left px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-blue-700 hover:bg-gray-50"
            >
              <div className="flex items-center">
                <ShieldCheck className="w-4 h-4 mr-2" />
                Authentification
              </div>
            </button>

            {isSchoolAdminRole(role) && (
              <>
                {/* Alumni Mobile */}
                {(isSchoolAuthorized(profileData?.ecole_nom || getConventionsByRole('school_head', user.email || '', (user.id || ''))[0]?.ecole_nom || '') || user.email === 'pledgeum@gmail.com') && (
                  <button
                    onClick={() => { setIsAlumniModalOpen(true); setIsMobileMenuOpen(false); }}
                    className="block w-full text-left px-3 py-2 rounded-md text-sm font-medium text-indigo-700 hover:text-indigo-900 hover:bg-indigo-50"
                  >
                    <div className="flex items-center">
                      <span className="mr-2">🎓</span>
                      Espace Alumni
                    </div>
                  </button>
                )}

                <button
                  onClick={() => { setIsSchoolAdminModalOpen(true); setIsMobileMenuOpen(false); }}
                  className="block w-full text-left px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-blue-700 hover:bg-gray-50"
                >
                  <div className="flex items-center">
                    <Settings className="w-4 h-4 mr-2" />
                    Administration
                  </div>
                </button>
              </>
            )}

            {(role === 'teacher' || isSchoolAdminRole(role) || user?.email === 'pledgeum@gmail.com') && (
              <button
                onClick={() => { setIsFeedbackModalOpen(true); setIsMobileMenuOpen(false); }}
                className="block w-full text-left px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-blue-700 hover:bg-gray-50"
              >
                <div className="flex items-center">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Feedback
                </div>
              </button>
            )}

            <div className="border-t border-gray-100 mt-2 pt-2">
              <button
                onClick={() => { setIsDeleteModalOpen(true); setIsMobileMenuOpen(false); }}
                className="block w-full text-left px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <div className="flex items-center">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Supprimer mon compte
                </div>
              </button>
              <button
                onClick={() => signOut()}
                className="block w-full text-left px-3 py-2 rounded-md text-sm font-medium text-gray-500 hover:text-red-600 hover:bg-gray-50"
              >
                <div className="flex items-center">
                  <LogOut className="w-4 h-4 mr-2" />
                  Déconnexion
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dashboard Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!isHighLevelAdmin(role) && (
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">
              Tableau de Bord {role === 'company_head_tutor'
                ? (dualRoleView === 'company_head' ? "Chef d'Entreprise" : "Tuteur")
                : roleLabels[role]} <span className="text-orange-600 text-sm ml-2 font-medium">version beta</span>
            </h1>
            <p className="text-gray-500 mt-1">Gérez vos conventions de stage et signatures.</p>

            {role === 'student' && null}
          </div>
        )}

        {effectiveRole === 'student' ? (
          // STUDENT DASHBOARD
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 w-full items-start">
              {/* Nouvelle Convention */}
              <div
                onClick={handleNewConvention}
                className={`group bg-white rounded-2xl border transition-all p-6 flex flex-col items-center justify-center cursor-pointer h-full relative ${!isProfileComplete()
                  ? 'border-orange-200 shadow-sm hover:shadow-orange-50 bg-orange-50/30'
                  : 'border-gray-100 shadow-sm hover:border-blue-200 hover:shadow-blue-50'
                  }`}
              >
                {!isProfileComplete() && (
                  <div className="absolute top-4 right-4 text-orange-500">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                )}
                <div className={`p-3 rounded-full transition-colors ${!isProfileComplete() ? 'bg-orange-100 text-orange-600' : 'bg-blue-50 group-hover:bg-blue-100 text-blue-600'
                  }`}>
                  {!isProfileComplete() ? <UserCircle className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
                </div>
                <span className="mt-1 text-sm font-bold text-gray-800 text-center leading-tight">
                  {!isProfileComplete() ? "Compléter le Profil" : "Nouvelle Convention"}
                </span>
              </div>

              {/* Trouver une entreprise */}
              <div
                onClick={() => setIsSearchModalOpen(true)}
                className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-purple-200 hover:shadow-purple-50 transition-all p-6 flex flex-col items-center justify-center cursor-pointer h-full"
                title="Trouver une entreprise ou un organisme d'accueil pour votre stage"
              >
                <div className="bg-purple-50 p-3 rounded-full group-hover:bg-purple-100 transition-colors text-purple-600">
                  <Building2 className="w-6 h-6" />
                </div>
                <span className="mt-1 text-sm font-bold text-gray-800 text-center leading-tight">
                  Trouver une Entreprise
                </span>
              </div>
            </div>

            <div className="mt-8">
              <ConventionList
                role={effectiveRole}
                userEmail={user.email || ''}
                userId={(user.id || '')}
                isRgpdModalOpen={isRgpdModalOpen}
                setIsRgpdModalOpen={setIsRgpdModalOpen}
                onModalChange={setIsChildModalOpen}
                isAbsenceModalOpen={isAbsenceModalOpen}
                setIsAbsenceModalOpen={setIsAbsenceModalOpen}
                selectedConventionId={selectedConventionId}
                setSelectedConventionId={setSelectedConventionId}
              />
            </div>
          </>
        ) : (
          // VALIDATOR DASHBOARD (Teacher, Heads, Tutor)
          <div className="space-y-8">
            {/* --- RESPONSIVE QUICK ACTIONS GRID --- */}
            {(role === 'teacher' || isHighLevelAdmin(role) || role === 'at_ddfpt') && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 w-full">
                {/* Gérer les visites (Matrice) */}
                {['teacher', 'admin', 'school_admin', 'ddfpt', 'at_ddfpt', 'business_manager'].includes(effectiveRole) && (
                  <button
                    onClick={() => setIsTrackingMatrixOpen(true)}
                    className="flex flex-col items-center justify-center p-6 bg-white border border-gray-100 rounded-2xl shadow-sm hover:border-indigo-200 hover:shadow-indigo-50 transition-all group h-full"
                  >
                    <div className="p-3 bg-indigo-50 rounded-full text-indigo-600 group-hover:bg-indigo-100 mb-3 transition-colors">
                      <MapPin className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-bold text-gray-800 text-center leading-tight">Gérer les visites</span>
                  </button>
                )}

                {/* Créer une Évaluation */}
                <button
                  onClick={() => router.push('/dashboard/evaluations')}
                  className="flex flex-col items-center justify-center p-6 bg-white border border-gray-100 rounded-2xl shadow-sm hover:border-orange-200 hover:shadow-orange-50 transition-all group h-full"
                >
                  <div className="p-3 bg-orange-50 rounded-full text-orange-600 group-hover:bg-orange-100 mb-3 transition-colors">
                    <ClipboardList className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-bold text-gray-800 text-center leading-tight">Créer une Évaluation</span>
                </button>
                
                {/* Contacter l'entreprise */}
                <button
                  onClick={() => setIsContactCompanyModalOpen(true)}
                  className="flex flex-col items-center justify-center p-6 bg-white border border-gray-100 rounded-2xl shadow-sm hover:border-emerald-200 hover:shadow-emerald-50 transition-all group h-full"
                >
                  <div className="p-3 bg-emerald-50 rounded-full text-emerald-600 group-hover:bg-emerald-100 mb-3 transition-colors">
                    <Building className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-bold text-gray-800 text-center leading-tight">Contacter l'entreprise</span>
                </button>

                {/* Ajouter des documents */}
                <button
                  onClick={() => setIsClassDocModalOpen(true)}
                  className="flex flex-col items-center justify-center p-6 bg-white border border-gray-100 rounded-2xl shadow-sm hover:border-blue-200 hover:shadow-blue-50 transition-all group h-full"
                >
                  <div className="p-3 bg-blue-50 rounded-full text-blue-600 group-hover:bg-blue-100 mb-3 transition-colors">
                    <FileText className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-bold text-gray-800 text-center leading-tight">Ajouter des documents</span>
                </button>

                {/* Trouver une entreprise */}
                <button
                  onClick={() => setIsSearchModalOpen(true)}
                  className="flex flex-col items-center justify-center p-6 bg-white border border-gray-100 rounded-2xl shadow-sm hover:border-purple-200 hover:shadow-purple-50 transition-all group h-full"
                >
                  <div className="p-3 bg-purple-50 rounded-full text-purple-600 group-hover:bg-purple-100 mb-3 transition-colors">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-bold text-gray-800 text-center leading-tight">Trouver une entreprise</span>
                </button>
              </div>
            )}

            {/* Tutor Specific Quick Actions */}
            {['tutor', 'company_head_tutor'].includes(effectiveRole) && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <button
                  onClick={() => setIsContactModalOpen(true)}
                  className="flex flex-col items-center justify-center p-6 bg-white border border-gray-100 rounded-2xl shadow-sm hover:border-indigo-200 hover:shadow-indigo-50 transition-all group h-full"
                >
                  <div className="p-3 bg-indigo-50 rounded-full text-indigo-600 group-hover:bg-indigo-100 mb-3 transition-colors">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-bold text-gray-800 text-center leading-tight">Contacter l'établissement</span>
                </button>

                <button
                  onClick={() => {
                    setSelectedConventionId(null);
                    setIsAbsenceModalOpen(true);
                  }}
                  className="flex flex-col items-center justify-center p-6 bg-white border border-gray-100 rounded-2xl shadow-sm hover:border-red-200 hover:shadow-red-50 transition-all group h-full"
                >
                  <div className="p-3 bg-red-50 rounded-full text-red-600 group-hover:bg-red-100 mb-3 transition-colors">
                    <CalendarX className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-bold text-gray-800 text-center leading-tight">Signaler une Absence</span>
                </button>
              </div>
            )}

            {/* --- DYNAMIC REORDERABLE SECTIONS --- */}
            <div className="space-y-6">
              {sectionsOrder.map((sectionId) => {
                if (sectionId === 'admin' && isHighLevelAdmin(role)) {
                  return (
                    <CollapsibleSection
                      key="admin"
                      title="Administrer l'établissement"
                      storageKey="dashboard_pref_admin_panel"
                      icon={<Shield className="w-5 h-5" />}
                      onMoveUp={() => moveSection('admin', 'up')}
                      onMoveDown={() => moveSection('admin', 'down')}
                    >
                      <SchoolAdminPanelSection />
                    </CollapsibleSection>
                  );
                }

                if (sectionId === 'progress' && showProgressChart) {
                  return (
                    <CollapsibleSection
                      key="progress"
                      title="Suivi de l'avancement"
                      storageKey="dashboard_pref_progress_chart"
                      icon={<BarChart3 className="w-5 h-5" />}
                      onMoveUp={() => moveSection('progress', 'up')}
                      onMoveDown={() => moveSection('progress', 'down')}
                    >
                      {displayClassIds?.length === 0 ? (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center flex flex-col items-center justify-center">
                          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
                          <p className="text-gray-500 text-sm font-medium">
                            Chargement de vos classes ou aucune classe assignée...
                          </p>
                        </div>
                      ) : (
                        <InternshipProgressChart uai={uai || ''} filterClassIds={displayClassIds || undefined} />
                      )}
                    </CollapsibleSection>
                  );
                }

                if (sectionId === 'conventions') {
                  return (
                    <CollapsibleSection
                      key="conventions"
                      title="Liste des Conventions"
                      storageKey="dashboard_pref_conventions_list"
                      icon={<FilesIcon className="w-5 h-5" />}
                      onMoveUp={() => moveSection('conventions', 'up')}
                      onMoveDown={() => moveSection('conventions', 'down')}
                    >
                      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                        <ConventionList
                          role={effectiveRole}
                          userEmail={user.email || ''}
                          userId={(user.id || '')}
                          isRgpdModalOpen={isRgpdModalOpen}
                          setIsRgpdModalOpen={setIsRgpdModalOpen}
                          onModalChange={setIsChildModalOpen}
                          isAbsenceModalOpen={isAbsenceModalOpen}
                          setIsAbsenceModalOpen={setIsAbsenceModalOpen}
                          selectedConventionId={selectedConventionId}
                          setSelectedConventionId={setSelectedConventionId}
                        />
                      </div>
                    </CollapsibleSection>
                  );
                }
                return null;
              })}
            </div>
          </div>
        )}
        {isProfileModalOpen && (
          <ProfileModal
            isOpen={true}
            onClose={() => {
              console.log("Home: onClose triggered from ProfileModal");
              setIsProfileModalOpen(false);
              setHasDismissedProfileModal(true);
              console.log("Home: Modal closed and dismissed set to true");
            }}
            conventionDefaults={getConventionsByRole(role, user.email || '', (user.id || ''))[0]}
            blocking={false} // NEVER BLOCK
          />
        )}

        {/* Helper to find the class managed by this teacher */}
        <TrackingMatrixModal
          isOpen={isTrackingMatrixOpen}
          onClose={() => setIsTrackingMatrixOpen(false)}
          currentUserRole={effectiveRole}
          currentTeacherEmail={user.email || ''}
          classId={(() => {
            // Find class where current user is main teacher
            // For demo, if 'pledgeum@gmail.com' (admin/dev), fallback to first class or specific test class
            const myClass = classes.find(c => c.mainTeacher?.email === user.email);
            return myClass?.id || classes[0]?.id || '';
          })()}
        />

        <SchoolAdminModal
          isOpen={isSchoolAdminModalOpen}
          onClose={() => setIsSchoolAdminModalOpen(false)}
        />
        <AlumniModal
          isOpen={isAlumniModalOpen}
          onClose={() => setIsAlumniModalOpen(false)}
          authorizedSchoolName={profileData?.ecole_nom || getConventionsByRole('school_head', user.email || '', (user.id || ''))[0]?.ecole_nom}
        />
        <SuperAdminModal
          isOpen={isSuperAdminModalOpen}
          onClose={() => setIsSuperAdminModalOpen(false)}
        />
        <FeedbackModal
          isOpen={isFeedbackModalOpen}
          onClose={() => setIsFeedbackModalOpen(false)}
        />
        <SignatureVerificationModal
          isOpen={isVerificationModalOpen}
          onClose={() => setIsVerificationModalOpen(false)}
          onViewDocument={(convention, type) => {
            setVerificationConvention(convention);
            setIsVerificationModalOpen(false);
            if (type === 'attestation') {
              setIsVerificationAttestationOpen(true);
            } else {
              setIsVerificationPdfOpen(true);
            }
          }}
        />
        {isVerificationPdfOpen && verificationConvention && (
          <PdfPreview
            data={verificationConvention}
            onClose={() => setIsVerificationPdfOpen(false)}
          />
        )}
        {isVerificationAttestationOpen && verificationConvention && (
          <AttestationModal
            isOpen={isVerificationAttestationOpen}
            onClose={() => setIsVerificationAttestationOpen(false)}
            convention={verificationConvention}
            currentUserEmail={user?.email || ''}
            currentUserRole={role || 'student'}
          />
        )}

        <SignatureVerificationModal
          isOpen={isVerificationModalOpen}
          onClose={() => setIsVerificationModalOpen(false)}
          onViewDocument={(convention, type) => {
            setVerificationConvention(convention);
            if (type === 'convention') {
              setIsVerificationPdfOpen(true);
            } else {
              setIsVerificationAttestationOpen(true);
            }
            setIsVerificationModalOpen(false);
          }}
        />

        {isVerificationPdfOpen && verificationConvention && (
          <PdfPreview
            data={verificationConvention}
            onClose={() => setIsVerificationPdfOpen(false)}
          />
        )}

        {isVerificationAttestationOpen && verificationConvention && (
          <AttestationModal
            isOpen={isVerificationAttestationOpen}
            onClose={() => setIsVerificationAttestationOpen(false)}
            convention={verificationConvention}
            currentUserEmail={user?.email || ''}
            currentUserRole={role || 'student'}
          // readonly={true} // Add if supported
          />
        )}

        <DeleteAccountModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onDelete={handleConfirmDeleteAccount}
        />
        <MissionOrderModal
          isOpen={isMissionOrderModalOpen}
          onClose={() => setIsMissionOrderModalOpen(false)}
        />
        <ClassDocumentModal
          isOpen={isClassDocModalOpen}
          onClose={() => setIsClassDocModalOpen(false)}
        />
        <StudentDocumentModal
          classId={studentDocModalClassId}
          onClose={() => setStudentDocModalClassId(null)}
        />
        <CompanySearchModal
          isOpen={isSearchModalOpen}
          onClose={() => setIsSearchModalOpen(false)}
          conventions={allConventions}
          studentAddress={
            (role === 'student' ? (getConventionsByRole('student', user.email || '', (user.id || ''))[0]?.eleve_adresse || '') :
              (user.email === 'pledgeum@gmail.com' ? "10 Rue de Rivoli, 75001 Paris" : ""))
          }
          schoolAddress="123 Avenue de la République, 75011 Paris"
        />
        {/* MOBILE: Floating Action Button for Student (New Convention) */}
        {role === 'student' && (
          <button
            onClick={handleNewConvention}
            className={`md:hidden fixed bottom-6 right-6 z-50 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg flex items-center justify-center transition-transform active:scale-95 ${isAnyModalOpen ? 'hidden' : ''}`}
            title="Nouvelle Convention"
          >
            <Plus className="w-6 h-6" />
          </button>
        )}

      {/* MOBILE FAB for Tutors - Global Absence Reporting */}
      {(effectiveRole === 'tutor') && (
        <button
          onClick={() => {
            setSelectedConventionId(null);
            setIsAbsenceModalOpen(true);
          }}
          className={`md:hidden fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-600/30 hover:bg-blue-700 active:scale-95 transition-all ${isAnyModalOpen ? 'hidden' : ''}`}
          title="Signaler une absence"
        >
          <CalendarX className="w-6 h-6" />
        </button>
      )}

      {/* Global Absence Modal */}
      {isAbsenceModalOpen && (
        <AbsenceReportModal
          isOpen={isAbsenceModalOpen}
          onClose={() => setIsAbsenceModalOpen(false)}
          convention={getConventionsByRole(effectiveRole, user?.email || '', user?.id || '').find(c => c.id === selectedConventionId)}
          conventions={getConventionsByRole(effectiveRole, user?.email || '', user?.id || '')}
          currentUserEmail={user?.email || ''}
          userRole={effectiveRole}
        />
      )}

      {/* MOBILE FAB for Teachers - Contact Company */}
      {(effectiveRole === 'teacher' || effectiveRole === 'main_teacher' || effectiveRole === 'teacher_tracker') && (
        <button
          onClick={() => setIsContactCompanyModalOpen(true)}
          className={`md:hidden fixed bottom-24 right-6 z-50 flex items-center justify-center w-14 h-14 bg-emerald-600 text-white rounded-full shadow-lg shadow-emerald-600/30 hover:bg-emerald-700 active:scale-95 transition-all ${isAnyModalOpen ? 'hidden' : ''}`}
          title="Contacter l'entreprise"
        >
          <Building className="w-6 h-6" />
        </button>
      )}

      {/* Global Contact Company Modal */}
      {isContactCompanyModalOpen && (
        <ContactCompanyModal
          isOpen={isContactCompanyModalOpen}
          onClose={() => setIsContactCompanyModalOpen(false)}
          conventions={getConventionsByRole(effectiveRole, user?.email || '', user?.id || '')}
        />
      )}

      {/* MOBILE FAB for Tutors - Contact School */}
      {effectiveRole === 'tutor' && (
        <button
          onClick={() => setIsContactModalOpen(true)}
          className={`md:hidden fixed bottom-24 right-6 z-50 flex items-center justify-center w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 active:scale-95 transition-all ${isAnyModalOpen ? 'hidden' : ''}`}
          title="Contacter l'établissement"
        >
          <Phone className="w-6 h-6" />
        </button>
      )}

      {/* Global Contact School Modal */}
      {isContactModalOpen && (
        <ContactSchoolModal
          isOpen={isContactModalOpen}
          onClose={() => setIsContactModalOpen(false)}
          conventions={getConventionsByRole(effectiveRole, user?.email || '', user?.id || '')}
        />
      )}
      </div>
    </main>
  );
}

// Sub-component for list rendering to keep Page clean
function ConventionList({
  role,
  userEmail,
  userId,
  isRgpdModalOpen,
  setIsRgpdModalOpen,
  onModalChange,
  view = 'standard',
  isAbsenceModalOpen,
  setIsAbsenceModalOpen,
  selectedConventionId,
  setSelectedConventionId
}: {
  role: UserRole,
  userEmail: string,
  userId?: string,
  isRgpdModalOpen: boolean,
  setIsRgpdModalOpen: (v: boolean) => void,
  onModalChange?: (isOpen: boolean) => void,
  view?: 'standard' | 'tutor',
  isAbsenceModalOpen: boolean,
  setIsAbsenceModalOpen: (v: boolean) => void,
  selectedConventionId: string | null,
  setSelectedConventionId: (v: string | null) => void
}) {
  const router = useRouter();
  const { getConventionsByRole, signConvention, sendReminder, bulkSignConventions, updateEmail, assignTrackingTeacher, fetchConventions } = useConventionStore();
  const { classes, fetchClassTeachers } = useSchoolStore();
  const { addNotification, name, schoolId } = useUserStore();
  const conventions = getConventionsByRole(role, userEmail, userId);

  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isAttestationModalOpen, setIsAttestationModalOpen] = useState(false);
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  // Unified state: 'parent', 'tutor', 'establishment', 'head', 'signature', or null
  const [activeModal, setActiveModal] = useState<string | null>(null);

  // Notify parent when any modal is open
  useEffect(() => {
    if (onModalChange) {
      onModalChange(activeModal !== null || isPdfModalOpen || isAbsenceModalOpen || isAttestationModalOpen || isTrackingModalOpen);
    }
  }, [activeModal, isPdfModalOpen, isAbsenceModalOpen, isAttestationModalOpen, isTrackingModalOpen, onModalChange]);

  // Evaluation Templates State
  const [evaluationTemplates, setEvaluationTemplates] = useState<any[]>([]);
  useEffect(() => {
    // Only fetch for relevant roles to avoid unnecessary reads
    if (role === 'student' || role === 'parent') return;

    const fetchTemplates = async () => {
      try {
        const res = await fetch('/api/templates');
        if (!res.ok) throw new Error("Erreur HTTP api templates");
        const data = await res.json();
        if (data.success) {
          setEvaluationTemplates(data.templates);
        }
      } catch (e) {
        console.error("Error fetching evaluation templates", e);
      }
    };
    fetchTemplates();
  }, [role]);

  // ⚡ Phase 1 : Hydratation BULK du vivier d'enseignants pour tout l'établissement
  const uai = useUserStore(state => state.uai || state.schoolId);
  const hasBulkHydratedRef = useRef<string | null>(null);
  
  useEffect(() => {
    // Seuls les rôles "école" ou admin ont besoin d'assigner des enseignants
    const staffRoles: UserRole[] = ['teacher', 'teacher_tracker', 'ddfpt', 'school_head', 'at_ddfpt', 'business_manager', 'ESTABLISHMENT_ADMIN'];
    if (!staffRoles.includes(role)) return;

    if (uai && hasBulkHydratedRef.current !== uai && classes.length > 0) {
      console.log(`[Dashboard] Déclenchement BULK UNIQUE fetchEstablishmentTeachersAssignments pour UAI : ${uai}`);
      hasBulkHydratedRef.current = uai;
      useSchoolStore.getState().fetchEstablishmentTeachersAssignments(uai);
    }
  }, [uai, classes.length, role]);



  // Filters State
  const [filterClass, setFilterClass] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterName, setFilterName] = useState('');

  // Helpers for filters
  const getSchoolYear = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const month = date.getMonth() + 1; // 1-12
    const year = date.getFullYear();
    // School year starts in September (9).
    // If Month >= 9, year is YYYY-{YYYY+1}
    // If Month < 9, year is {YYYY-1}-YYYY
    if (month >= 9) return `${year}-${year + 1}`;
    return `${year - 1}-${year}`;
  };

  // Derive unique options
  const uniqueClasses = Array.from(new Set(conventions.map(c => c.eleve_classe).filter(Boolean))).sort();
  const uniqueYears = Array.from(new Set(conventions.map(c => getSchoolYear(c.stage_date_debut)).filter(Boolean))).sort().reverse();

  const [odmPreviewData, setOdmPreviewData] = useState<{ odm: MissionOrder, convention: Convention, hashCode?: string } | null>(null);
  const [isSigningOdm, setIsSigningOdm] = useState(false);

  const { missionOrders, fetchMissionOrders, signMissionOrders, signMissionOrderTeacher } = useMissionOrderStore();

  useEffect(() => {
    fetchMissionOrders();
  }, [fetchMissionOrders]);

  const [odmQrCodeUrl, setOdmQrCodeUrl] = useState<string>('');
  const [odmSignatureRole, setOdmSignatureRole] = useState<'teacher' | 'head'>('teacher');

  const handleDownloadOdm = async (odm: MissionOrder, convention: Convention) => {
    // Generate QR Code for Mission Order
    try {
      const { url, hashDisplay } = await generateVerificationUrl(convention, 'mission_order');
      const qrCode = await QRCode.toDataURL(url);
      setOdmQrCodeUrl(qrCode);
      setOdmPreviewData({ odm, convention, hashCode: hashDisplay });
    } catch (e) {
      console.error("Failed to generate ODM QR Code", e);
      setOdmPreviewData({ odm, convention });
    }
  };

  const executeDownloadOdm = async (odm: MissionOrder, convention: Convention) => {
    try {
      // Regenerate QR for download to ensure fresh URL
      const { url, hashDisplay } = await generateVerificationUrl(convention, 'mission_order');
      const qrCode = await QRCode.toDataURL(url);

      const { generateMissionOrderBlob } = await import('@/components/pdf/CredentialPdfGenerator');
      const blob = await generateMissionOrderBlob(odm, convention, qrCode, hashDisplay);
      const pdfUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `ODM_${convention.eleve_nom}_${convention.eleve_prenom}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("PDF generation failed", error);
      alert("Erreur lors de la génération du PDF");
    }
  };

  const handleSignOdm = async (method: 'canvas' | 'otp', signatureImg?: string) => {
    if (!odmPreviewData) return;

    if (method === 'canvas' && signatureImg) {
      if (odmSignatureRole === 'teacher') {
        await signMissionOrderTeacher(odmPreviewData.odm.id, signatureImg, name || "Enseignant");
      } else {
        await signMissionOrders([odmPreviewData.odm.id], signatureImg, name || "Chef d'Établissement");
      }
    }

    // Refresh store to get latest data with the new JSONB structures (CRITICAL for OTP)
    await fetchMissionOrders();

    setOdmPreviewData(null);
    setIsSigningOdm(false);
    addNotification({ title: "Ordre de Mission signé", message: "Le document a été mis à jour avec succès." });
  };

  // Email Correction State
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailEditRole, setEmailEditRole] = useState<string>('');

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkSigning, setIsBulkSigning] = useState(false);

  const isActionable = (conv: Convention, role: UserRole) => {
    const status = conv.status;
    if (status === 'REJECTED') return false;

    if (role === 'teacher') {
      // Teacher validates SUBMITTED only if Major, otherwise waits for SIGNED_PARENT
      if (status === 'SUBMITTED' && !conv.est_mineur) return true;
      if (status === 'SIGNED_PARENT') return true;
      return false;
    }

    // Parent signs SUBMITTED only if Minor
    if (role === 'parent' && status === 'SUBMITTED' && conv.est_mineur) return true;

    // Flexible Signing Logic for Partners
    if (role === 'company_head' || role === 'tutor' || role === 'company_head_tutor') {
      const isReady = ['VALIDATED_TEACHER', 'SIGNED_COMPANY', 'SIGNED_TUTOR'].includes(status);
      if (!isReady) return false;

      // Use signatures nested structure
      if (role === 'company_head') return !conv.signatures?.company_head?.signedAt;
      if (role === 'tutor') return !conv.signatures?.tutor?.signedAt;
      if (role === 'company_head_tutor') {
        // Dual role: actionable if EITHER is missing (or maybe we force BOTH?)
        // Usually, the Signer button opens the modal which has the dual sign checkbox.
        // So it's actionable if both are missing OR if they want to sign the remaining one.
        return !conv.signatures?.company_head?.signedAt || !conv.signatures?.tutor?.signedAt;
      }
    }

    if (role === 'school_head' && status === 'SIGNED_TUTOR') return true;
    return false;
  };



  // Filtering Logic
  const filteredConventions = conventions.filter(c => {
    // 1. Check permission for UI filtering (Lists are already securely fetched by Store based on Role)
    if (!hasFilterAccess(role)) return true;

    // 2. Apply UI Filters
    if (filterClass && c.eleve_classe !== filterClass) return false;
    if (filterYear && getSchoolYear(c.stage_date_debut) !== filterYear) return false;
    if (filterName) {
      const search = filterName.toLowerCase();
      const fullName = `${c.eleve_nom} ${c.eleve_prenom}`.toLowerCase();
      if (!fullName.includes(search)) return false;
    }
    return true;
  });

  // Sorting Logic
  // Sorting Logic
  const sortedConventions = [...filteredConventions].sort((a, b) => {
    // If ANY filter is active (Class, Year, or Name), sort ALPHABETICALLY by Student Name
    if (filterClass || filterYear || filterName) {
      const nameA = `${a.eleve_nom} ${a.eleve_prenom}`.toLowerCase();
      const nameB = `${b.eleve_nom} ${b.eleve_prenom}`.toLowerCase();
      return nameA.localeCompare(nameB);
    }

    // Default (No Filters): Sort by Creation Date (Most Recent first)
    // The user requested "classified from most recent to oldest"
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return dateB - dateA;
  });

  // STUDENT PORTFOLIO LOGIC: Separate Current vs History
  const finalDisplayList = (() => {
    if (role !== 'student' || !schoolId) return sortedConventions;

    // FIX: Only consider "Previous/History" if schoolId IS DEFINED and strictly DIFFERENT
    // If c.schoolId is missing/undefined, we assume it's current (optimistic update safety)
    const current = sortedConventions.filter(c => !c.schoolId || c.schoolId === schoolId);
    const past = sortedConventions.filter(c => c.schoolId && c.schoolId !== schoolId);

    if (past.length === 0) return current;

    // Insert Separator (We'll handle this 'fake' convention in the map)
    const separator = { id: 'SEPARATOR_HISTORY', isSeparator: true } as any;
    return [...current, separator, ...past];
  })();

  // Bulk Selection Helpers
  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === sortedConventions.filter(c => isActionable(c, role)).length) {
      setSelectedIds(new Set());
    } else {
      const actionableIds = sortedConventions.filter(c => isActionable(c, role)).map(c => c.id);
      setSelectedIds(new Set(actionableIds));
    }
  };

  const handleOpenSignModal = (id: string) => {
    const conv = conventions.find(c => c.id === id);
    if (!conv) return;

    // Strict Identity Check (Except for Parent who uses Profile, and Super Admin)
    // The user explicitly requested: "L'utilisateur connecté doit être l'utilisateur dont l'email est inscrit dans la convention"
    if (role !== 'parent' && userEmail !== 'pledgeum@gmail.com') {
      let expectedEmail = '';
      if (role === 'teacher') expectedEmail = conv.prof_email;
      else if (role === 'company_head') expectedEmail = conv.ent_rep_email;
      else if (role === 'tutor') expectedEmail = conv.tuteur_email;
      // School admin check might vary (generic role vs specific name), allowing loose match or verifying via school list
      // For now, enforcing strict match for main external roles

      if (expectedEmail && expectedEmail.toLowerCase() !== userEmail.toLowerCase()) {
        alert(`Attention: L'email de votre compte (${userEmail}) ne correspond pas à l'email inscrit dans la convention (${expectedEmail}).\n\nVous ne pouvez pas signer ce document.`);
        return;
      }
    }

    setSelectedConventionId(id);
    setIsBulkSigning(false);

    switch (role) {
      case 'parent':
        setActiveModal('parent');
        break;
      case 'tutor':
        setActiveModal('tutor');
        break;
      case 'company_head':
        setActiveModal('establishment');
        break;
      case 'company_head_tutor':
        // Inside this handler, dialRoleView is not in scope. Defaulting to 'establishment' 
        // as the CompanyValidationModal handles the dual signature process anyway.
        setActiveModal('establishment');
        break;
      case 'school_head':
        // case 'ddfpt': // Maybe DDFPT also signs? Usually they validate, head signs.
        setActiveModal('head');
        break;
      default:
        // For other roles or direct signature
        setActiveModal('signature');
    }
  };

  const handleBulkSignClick = () => {
    setIsBulkSigning(true);
    setActiveModal('signature');
  };


  const handleSign = async (method: 'canvas' | 'otp', signatureImage?: string, extraAuditLog?: any, dualSign?: boolean) => {
    // If bulk logic exists, it might need update too, but focusing on single sign for now
    if (selectedConventionId) {
      // For bulk signing (if enabled later), we'd need to handle logs per convention
      // Currently bulk is disabled or only for validation which doesn't use OTP log
    }
    // Currently bulk is disabled or only for validation which doesn't use OTP log

    if (isBulkSigning) { // This `isBulkMode` variable is not present in the original code. It seems like a new addition.
      // Bulk signing logic (simplified for now, assumes no OTP usually for teacher validation)
      const conventionsToSign = sortedConventions
        .filter(c => isActionable(c, role) && selectedIds.has(c.id));

      try {
        await Promise.all(conventionsToSign.map(c => signConvention(c.id, role, signatureImage))); // Bulk dual sign not supported yet
        setSelectedIds(new Set());
        setIsBulkSigning(false);
        addNotification({
          title: 'Signature groupée',
          message: `${conventionsToSign.length} conventions ont été signées avec succès.`
        });

        // INSTANT REFRESH
        router.refresh();

      } catch (error) {
        addNotification({ title: 'Erreur', message: 'Erreur lors de la signature groupée.' });
      }
    } else if (selectedConventionId) {
      try {
        // Execute the sign action (Store updates internally optimistically or via response)
        // Note: signConvention in Store already performs a set() on the state.
        const result = await signConvention(selectedConventionId, role, signatureImage, undefined, extraAuditLog, dualSign);

        addNotification({
          title: 'Signature enregistrée',
          message: `La convention a été signée avec succès (Méthode: ${method === 'canvas' ? 'Manuscrite' : 'OTP'}).`,
        });

        // STEP B: Server Sync (The "Double Tap")
        // Ensures any server-side logic (or ISR) is reflected
        router.refresh();

        return result;

      } catch (error: any) {
        console.error("Sign Error:", error);
        // Feedback visuel pour l'utilisateur
        addNotification({
          title: 'Erreur de signature',
          message: error.message || "Impossible de signer la convention. Vérifiez que c'est bien votre tour.",
        });
        // On re-propagée l'erreur pour que le SignatureModal puisse arrêter le chargement
        // et rester sur l'écran de signature au lieu d'afficher un succès erroné.
        throw error;
      }
    }
    // REMOVED: setIsSigModalOpen(false); 
    // We keep the modal open to show the Success Screen (managed inside SignatureModal).
    // The modal will call onClose() when the user clicks "OK".
  };
  // ...
  // ... (Skipping getActionLabel etc)
  // ...


  const getActionLabel = (status: string, role: UserRole, conv: Convention) => {
    if (role === 'teacher') {
      if (status === 'SUBMITTED' || status === 'SIGNED_PARENT') return 'Valider le projet';
      if (status === 'REJECTED') return 'Voir les motifs';
    }
    if (role === 'parent' && status === 'SUBMITTED') return 'Vérifier et Signer';

    // Flexible Logic
    if (role === 'company_head' || role === 'tutor' || role === 'company_head_tutor') {
      const isReady = ['VALIDATED_TEACHER', 'SIGNED_COMPANY', 'SIGNED_TUTOR'].includes(status);
      if (isReady) {
        if ((role === 'company_head' || role === 'company_head_tutor') && !conv.signatures?.company_head?.signedAt) return 'Signer la convention';
        if ((role === 'tutor' || role === 'company_head_tutor') && !conv.signatures?.tutor?.signedAt) return 'Signer la convention';
      }
    }

    if (role === 'school_head' && status === 'SIGNED_TUTOR') return 'Signer la convention';

    return 'Voir le dossier';
  };

  const getSignatureStatusLabel = (conv: Convention) => {
    if (conv.status === 'VALIDATED_HEAD') {
      return (
        <span className="flex items-center text-green-600 font-medium">
          <CheckCircle className="w-4 h-4 mr-1" />
          Convention signée par tous et validée
        </span>
      );
    }

    let pendingRole = '';
    const signatures = conv.signatures as any;
    switch (conv.status) {
      case 'SUBMITTED': pendingRole = conv.est_mineur ? 'Représentant Légal' : 'Enseignant Référent/Professeur Principal'; break;
      case 'SIGNED_PARENT': pendingRole = 'Enseignant Référent/Professeur Principal'; break;
      case 'VALIDATED_TEACHER':
        // Could be both or just one if flexible
        if (signatures?.tutor?.signedAt && !signatures?.company_head?.signedAt) pendingRole = 'Chef d\'Entreprise';
        else if (!signatures?.tutor?.signedAt && signatures?.company_head?.signedAt) pendingRole = 'Tuteur'; // Rare if status update worked, but handle it
        else pendingRole = 'Tuteur et Chef d\'Entreprise';
        break;
      case 'SIGNED_COMPANY': pendingRole = 'Tuteur'; break;
      case 'SIGNED_TUTOR': pendingRole = 'Chef d\'Établissement'; break;
      case 'REJECTED': return <span className="text-red-600 font-medium">Demande rejetée / À corriger</span>;
      default: pendingRole = 'Inconnu';
    }

    return (
      <span className="flex items-center text-orange-600 font-medium">
        <AlertCircle className="w-4 h-4 mr-1" />
        En attente de signature : {pendingRole}
      </span>
    );
  };

  if (conventions.length === 0) {
    return (
      <div className="p-10 text-center text-gray-500">
        Aucune convention à traiter pour le moment.
      </div>
    );
  }

  const actionableCount = sortedConventions.filter(c => isActionable(c, role)).length;

  return (
    <div className="divide-y divide-gray-200">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center sticky top-0 z-40">
        <div className="flex flex-col gap-4 w-full md:w-auto">
          <div className="flex items-center space-x-4">
            {isSchoolAdminRole(role) && actionableCount > 0 && (
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedIds.size === actionableCount && actionableCount > 0}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Tout sélectionner ({actionableCount})</span>
              </div>
            )}
            <h2 className="text-lg font-medium text-gray-900 ml-4">Liste des Conventions</h2>
          </div>

          {/* FILTERS TOOLBAR (Only for Admin Roles) */}
          {hasFilterAccess(role) && (
            <div className="grid grid-cols-2 md:flex md:flex-wrap items-center gap-2 mt-2 md:mt-0 w-full md:w-auto">
              <div className="relative">
                <select
                  value={filterClass}
                  onChange={(e) => setFilterClass(e.target.value)}
                  className="block w-full md:w-40 pl-3 pr-8 py-1.5 text-xs md:text-sm text-gray-900 border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
                >
                  <option value="">Toutes classes</option>
                  {uniqueClasses.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="relative">
                <select
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  className="block w-full md:w-40 pl-3 pr-8 py-1.5 text-xs md:text-sm text-gray-900 border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
                >
                  <option value="">Toutes années</option>
                  {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="relative col-span-2 md:col-span-0">
                <input
                  type="text"
                  placeholder="Rechercher élève..."
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  className="block w-full md:w-48 pl-3 pr-3 py-1.5 text-xs md:text-sm text-gray-900 border-gray-300 placeholder:text-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
                />
              </div>
              {(filterClass || filterYear || filterName) && (
                <button
                  onClick={() => { setFilterClass(''); setFilterYear(''); setFilterName(''); }}
                  className="col-span-2 md:col-span-0 text-xs text-blue-600 hover:underline text-center md:text-left"
                >
                  Effacer
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center space-x-3">
          {isSchoolAdminRole(role) && selectedIds.size > 0 && (
            <button
              onClick={handleBulkSignClick}
              className="flex items-center justify-center px-4 py-2 border border-transparent shadow-sm text-sm font-bold rounded-md text-white bg-blue-600 hover:bg-blue-700 animate-pulse"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Signer {selectedIds.size} conventions
            </button>
          )}
          <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-full text-center inline-flex items-center justify-center">
            {filteredConventions.length} {isSchoolAdminRole(role) ? 'conventions à signer' : 'dossier(s)'}
          </span>
        </div>
      </div>

      {finalDisplayList.map((item) => {
        if ('isSeparator' in item) {
          return (
            <div key="separator-history" className="flex items-center my-8">
              <div className="flex-grow border-t border-gray-300"></div>
              <span className="flex-shrink-0 mx-4 text-gray-500 font-bold uppercase tracking-wider text-sm">
                Établissements Précédents (Historique)
              </span>
              <div className="flex-grow border-t border-gray-300"></div>
            </div>
          );
        }
        const conv = item as Convention;
        const actionable = isActionable(conv, role);

        // Find assigned evaluation for this convention's class
        const assignedTemplate = evaluationTemplates.find(t => t.assignedClassIds?.includes(conv.class_id || ''));

        // Check if user is authorized to FILL the evaluation
        const canFillEvaluation = assignedTemplate && (
          (role === 'teacher' && (conv.prof_email === userEmail || conv.prof_suivi_email === userEmail)) || // Teacher
          (role === 'teacher_tracker' && conv.prof_suivi_email === userEmail) || // Tracker
          (role === 'tutor' && conv.tuteur_email === userEmail) || // Tutor
          (role === 'company_head_tutor' && conv.tuteur_email === userEmail) || // Dual Role
          (userEmail === 'pledgeum@gmail.com' && (role === 'teacher' || role === 'tutor' || role === 'teacher_tracker')) // TEST ACCOUNT (Only if acts as Teacher/Tutor)
        );

        // Check if user is authorized to VIEW (Head, DDFPT) - They see the button, but page handles "completed" check
        const canViewEvaluation = assignedTemplate && (
          role === 'school_head' ||
          role === 'ddfpt' ||
          role === 'at_ddfpt'
        );

        return (
          <div
            key={conv.id}
            className={`bg-white shadow rounded-lg p-6 mb-4 transition-all duration-300 ${
              // Highlighting for Tracked Students
              (role === 'teacher_tracker' || role === 'teacher') && conv.prof_suivi_email === userEmail
                ? 'border-2 border-green-400 bg-green-50 shadow-[0_0_15px_rgba(74,222,128,0.3)] animate-[breathe_4s_ease-in-out_infinite]'
                : 'border border-gray-200'
              }`}
          >
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start space-x-3 sm:space-x-4">
                {/* Selection Checkbox for School Head */}
                {isSchoolAdminRole(role) && actionable && (
                  <div className="flex items-center h-full pt-1">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(conv.id)}
                      onChange={() => toggleSelection(conv.id)}
                      className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                    />
                  </div>
                )}

                <div className="bg-blue-100 p-2 rounded-full shrink-0">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-gray-900">
                    {role === 'student'
                      ? `Stage chez ${conv.ent_nom} (${conv.ent_ville})`
                      : `${conv.eleve_prenom} ${conv.eleve_nom} chez ${conv.ent_nom} (${conv.ent_ville})`}
                  </h4>
                  <div className="flex flex-col sm:flex-row sm:items-center text-sm text-gray-500 mt-1">
                    <span className="font-medium text-gray-700 mr-2">{conv.eleve_classe}</span>
                    {conv.ecole_nom && (
                      <span className="ml-2 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full font-medium border border-blue-100">
                        {conv.ecole_nom}
                      </span>
                    )}
                    <span className="hidden sm:inline mx-2 text-gray-300">•</span>
                    <span className="flex items-center mt-1 sm:mt-0">
                      <span className="mr-1">Du</span>
                      {conv.stage_date_debut ? new Date(conv.stage_date_debut).toLocaleDateString('fr-FR') : 'N/A'}
                      <span className="mx-1">au</span>
                      {conv.stage_date_fin ? new Date(conv.stage_date_fin).toLocaleDateString('fr-FR') : 'N/A'}
                    </span>
                    {conv.est_mineur && <span className="mt-1 sm:mt-0 sm:ml-3 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full inline-block w-fit">Mineur</span>}
                  </div>

                  {/* Display Tracking Teacher Name if assigned */}
                  {conv.visit?.tracking_teacher_email && (
                    <div className="mt-2 text-sm text-gray-600 flex items-center">
                      <UserPlus className="w-4 h-4 mr-2 text-indigo-500" />
                      <span>
                        Suivi par : <span className="font-semibold text-indigo-700">
                          {conv.visit.tracking_teacher_first_name && conv.visit.tracking_teacher_last_name
                            ? `${conv.visit.tracking_teacher_first_name} ${conv.visit.tracking_teacher_last_name}`
                            : conv.visit.tracking_teacher_email.includes('.temp')
                              ? "Compte enseignant en cours de création"
                              : conv.visit.tracking_teacher_email}
                        </span>
                        <span className="text-gray-500 font-normal ml-1">
                          ({conv.visit.tracking_teacher_email.includes('.temp')
                            ? "email non encore renseigné par l'enseignant concerné"
                            : conv.visit.tracking_teacher_email})
                        </span>
                      </span>
                    </div>
                  )}

                  {/* Pedagogical Tracking Assignment - Live Dropdown for Teacher */}
                  {(role === 'teacher' || role === 'ddfpt' || role === 'at_ddfpt') && conv.status !== 'REJECTED' && (
                    <div className="mt-3 bg-indigo-50 p-2 rounded-md border border-indigo-100 inline-block min-w-[250px]">
                      <label className="block text-xs font-bold text-indigo-800 mb-1 flex items-center">
                        <UserPlus className="w-3 h-3 mr-1" />
                        Suivi Pédagogique
                      </label>
                      <select
                        value={conv.prof_suivi_email || ''}
                        onChange={(e) => assignTrackingTeacher(conv.id, e.target.value)}
                        className="block w-full text-sm border-indigo-200 rounded-md focus:ring-indigo-500 focus:border-indigo-500 bg-white py-1 pl-2 pr-7 h-8 cursor-pointer"
                      >
                        <option value="">-- Non assigné --</option>
                        {userEmail === 'pledgeum@gmail.com' && <option value="pledgeum@gmail.com">-- TEST (Moi-même) --</option>}
                        {(() => {
                          const cls = classes.find(c => c.name === conv.eleve_classe);
                          const assignedEmail = conv.prof_suivi_email;
                          const hasTeachers = cls?.teachersList && cls.teachersList.length > 0;
                          const isAssignedInList = hasTeachers && cls.teachersList.some(t => t.email === assignedEmail);

                          // Si pas de profs chargés mais un prof est déjà assigné
                          if (!hasTeachers && assignedEmail) {
                            return (
                              <>
                                <option value={assignedEmail}>
                                  {conv.visit?.tracking_teacher_last_name
                                    ? `${conv.visit.tracking_teacher_last_name} ${conv.visit.tracking_teacher_first_name} (Chargement...)`
                                    : `${assignedEmail} (Chargement...)`}
                                </option>
                                <option value="" disabled>Chargement du vivier...</option>
                              </>
                            );
                          }

                          if (!hasTeachers) {
                            return <option value="" disabled>Aucun enseignant dans le vivier</option>;
                          }

                          const teacherOptions = cls.teachersList.map(t => (
                            <option key={t.id} value={t.email}>
                              {t.lastName} {t.firstName}
                            </option>
                          ));

                          // Cas de secours : si l'assigné n'est pas dans la liste officielle (ex: prof d'une autre classe ou cache)
                          if (assignedEmail && !isAssignedInList) {
                            teacherOptions.unshift(
                              <option key="assigned-fallback" value={assignedEmail}>
                                {conv.visit?.tracking_teacher_last_name
                                  ? `${conv.visit.tracking_teacher_last_name} ${conv.visit.tracking_teacher_first_name}`
                                  : assignedEmail} (Assigné)
                              </option>
                            );
                          }

                          return teacherOptions;
                        })()}
                      </select>
                      <p className="text-[10px] text-indigo-400 mt-1 italic">Assignation automatique</p>
                    </div>
                  )}


                </div>
              </div>

              {/* Status Label - Right Side */}
              <div className="flex flex-col items-end space-y-1">
                <ConventionStatusBadge status={conv.status} signatures={conv.signatures} isOutOfPeriod={conv.is_out_of_period} />
                {conv.status === 'REJECTED' && conv.rejection_reason && (
                  <div className="mt-2 text-left bg-red-50 border border-red-100 rounded-lg p-3 text-red-700 animate-in fade-in slide-in-from-top-1">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="font-bold text-xs uppercase tracking-tight">Convention Refusée</span>
                    </div>
                    <p className="text-sm italic leading-tight">
                      &ldquo; {conv.rejection_reason} &rdquo;
                    </p>
                  </div>
                )}
                <span className="text-xs text-gray-500">
                  {conv.updatedAt && !isNaN(new Date(conv.updatedAt).getTime())
                    ? `Mis à jour le ${new Date(conv.updatedAt).toLocaleDateString()}`
                    : ''}
                </span>
              </div>
            </div>

            {/* Footer: Timeline + Actions */}
            <div className="mt-6 flex flex-col sm:flex-row sm:justify-between items-center gap-4 border-t pt-4 flex-wrap">
              <div className="w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
                <SignatureTimeline 
                  convention={conv} 
                  onEditEmail={(roleTarget) => {
                    setSelectedConventionId(conv.id);
                    setEmailEditRole(roleTarget);
                    setIsEmailModalOpen(true);
                  }}
                />
              </div>

              {/* Class Documents Button - Visible to School Staff and Students */}
              {(() => {
                const cls = classes.find(c => c.name === conv.eleve_classe);
                if (!cls) return null;

                const allowedRoles = ['admin', 'teacher', 'main_teacher', 'school_head', 'ddfpt', 'at_ddfpt', 'business_manager', 'student'];
                if (!allowedRoles.includes(role)) return null;

                return (
                  <div className="flex-1 sm:flex-none">
                    <StudentDocumentButton classId={conv.eleve_classe} />
                  </div>
                );
              })()}

              <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => {
                    setSelectedConventionId(conv.id);
                    setIsPdfModalOpen(true);
                  }}
                  className="flex-1 sm:flex-none px-3 py-2 border border-blue-200 shadow-sm text-sm font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100"
                >
                  Convention
                </button>

                {/* EVALUATIONS BUTTONS */}
                {assignedTemplate && (
                  <div className="flex-1 sm:flex-none">
                    {canFillEvaluation && (
                      <button
                        onClick={() => router.push(`/dashboard/evaluations/${assignedTemplate.id}/fill/${conv.id}`)}
                        className="w-full sm:w-auto px-3 py-2 border border-purple-200 shadow-sm text-sm font-medium rounded-md text-purple-700 bg-purple-50 hover:bg-purple-100 flex items-center justify-center"
                      >
                        <FileSpreadsheet className="w-4 h-4 mr-2" />
                        Remplir l'évaluation
                      </button>
                    )}
                    {canViewEvaluation && !canFillEvaluation && (
                      <button
                        onClick={() => router.push(`/dashboard/evaluations/${assignedTemplate.id}/fill/${conv.id}`)}
                        className="w-full sm:w-auto px-3 py-2 border border-purple-200 shadow-sm text-sm font-medium rounded-md text-purple-700 bg-purple-50 hover:bg-purple-100 flex items-center justify-center"
                      >
                        <FileSpreadsheet className="w-4 h-4 mr-2" />
                        Voir l'évaluation
                      </button>
                    )}
                  </div>
                )}

                {/* Absences Button */}
                {conv.status === 'VALIDATED_HEAD' && (
                  <button
                    onClick={() => {
                      setSelectedConventionId(conv.id);
                      setIsAbsenceModalOpen(true);
                    }}
                    className="flex-1 sm:flex-none px-3 py-2 border border-red-200 shadow-sm text-sm font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100"
                    title="Signaler une absence"
                  >
                    Absences
                  </button>
                )}



                {/* Attestation Button */}
                {conv.status === 'VALIDATED_HEAD' && (
                  <button
                    onClick={() => {
                      setSelectedConventionId(conv.id);
                      setIsAttestationModalOpen(true);
                    }}
                    className={`flex-1 sm:flex-none px-3 py-2 border shadow-sm text-sm font-medium rounded-md
                      ${conv.attestationSigned
                        ? 'border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100'
                        : 'border-gray-200 text-gray-700 bg-gray-50 hover:bg-gray-100'}`}
                  >
                    Attestation
                  </button>
                )}

                {/* Mission Order Button - Visible to all Staff */}
                {!['student', 'parent', 'tutor', 'company_head', 'company_head_tutor'].includes(role) && conv.status !== 'REJECTED' && (() => {
                  const odm = missionOrders.find(m => m.conventionId === conv.id);
                  const isHeadSigned = !!odm?.signature_data?.head?.hash;
                  const isTeacherSigned = !!odm?.signature_data?.teacher?.hash;
                  const isTrackingTeacher = userEmail === conv.prof_suivi_email || userEmail === conv.visit?.tracking_teacher_email;

                  if (!odm) return null;

                  const isUserHead = ['school_head', 'admin', 'school_admin', 'ddfpt', 'at_ddfpt'].includes(role);
                  const isUserTeacher = isTrackingTeacher;

                  // Decide what action to show
                  const needsSignature = (isUserHead && !isHeadSigned) || (isUserTeacher && !isTeacherSigned);

                  if (needsSignature) {
                    return (
                      <button
                        onClick={() => {
                          setOdmPreviewData({ odm, convention: conv });
                          setOdmSignatureRole(isUserHead ? 'head' : 'teacher');
                          setIsSigningOdm(true);
                        }}
                        className="flex-1 sm:flex-none px-3 py-2 border border-blue-200 shadow-sm text-sm font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 whitespace-nowrap animate-pulse"
                        title="Signer l'ordre de mission"
                      >
                        <PenTool className="w-4 h-4 mr-2 inline" />
                        Signer l'ODM
                      </button>
                    );
                  }

                  return (
                    <button
                      onClick={() => odm && handleDownloadOdm(odm, conv)}
                      className={`flex-1 sm:flex-none px-3 py-2 border shadow-sm text-sm font-medium rounded-md
                          ${isHeadSigned
                          ? 'border-green-200 text-green-700 bg-green-50 hover:bg-green-100'
                          : 'border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100'}`}
                      title={isHeadSigned ? "Télécharger l'Ordre de Mission signé" : "Voir l'ODM (En attente de signature chef)"}
                    >
                      {isHeadSigned ? <CheckCircle className="w-4 h-4 mr-2 inline" /> : <FileText className="w-4 h-4 mr-2 inline" />}
                      {isHeadSigned ? "Télécharger l'ODM" : "Voir l'ODM"}
                    </button>
                  );
                })()}

                {/* WORKFLOW ACTIONS */}
                <ConventionActions
                  convention={conv}
                  onUpdate={() => fetchConventions(schoolId || '')} // Refresh list
                  onSign={() => handleOpenSignModal(conv.id)}
                />

                {/* Legacy Reminder Button (Keep if not replaced by Actions) */}
                {!actionable && role !== 'student' && role !== 'parent' && (
                  <button
                    onClick={() => {
                      sendReminder(conv.id).then(() => {
                        addNotification({ title: "Rappel envoyé", message: "Le rappel a été envoyé avec succès par email." });
                      }).catch(err => {
                        addNotification({ title: "Erreur", message: err.message });
                      });
                    }}
                    className="flex-1 sm:flex-none px-3 py-2 border border-blue-200 shadow-sm text-sm font-medium rounded-md text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
                    title="Envoyer un rappel par email"
                  >
                    <Bell className="w-4 h-4" />
                  </button>
                )}

                {/* Invalid Email Correction Button */}
                {(conv.invalidEmails && conv.invalidEmails.length > 0) && (role === 'teacher' || role === 'school_head') && (
                  <button
                    onClick={() => {
                      setEmailEditRole(conv.invalidEmails![0]);
                      setSelectedConventionId(conv.id);
                      setIsEmailModalOpen(true);
                    }}
                    className="flex-1 sm:flex-none px-3 py-2 border border-orange-200 shadow-sm text-sm font-medium rounded-md text-orange-600 bg-orange-50 hover:bg-orange-100"
                    title="Corriger l'adresse email invalide"
                  >
                    <AlertCircle className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      <TosModal
        isOpen={isRgpdModalOpen}
        onClose={() => setIsRgpdModalOpen(false)}
      />

      <SignatureModal
        isOpen={activeModal === 'signature'}
        onClose={() => setActiveModal(null)}
        onSign={handleSign}
        role={role}
        conventionId={selectedConventionId || ''}
        signeeName={(() => {
          const c = conventions.find(c => c.id === selectedConventionId);
          if (!c) return '';
          // Always prioritize the current logged-in user's name if they are signing
          if (name) return name;

          if (role === 'student') return `${c.eleve_prenom} ${c.eleve_nom}`;
          if (role === 'parent') return c.rep_legal_nom || 'Parent';
          if (role === 'teacher') return c.prof_nom || 'Enseignant';
          if (role === 'company_head') return c.ent_rep_nom || 'Chef d\'Entreprise';
          if (role === 'tutor') return c.tuteur_nom || 'Tuteur';
          if (isSchoolAdminRole(role)) return c.ecole_chef_nom || 'Directeur';
          return '';
        })() ?? ''}
        signeeEmail={(() => {
          const c = conventions.find(c => c.id === selectedConventionId);
          if (!c) return '';
          // Always prioritize the current logged-in user's email for OTP
          if (userEmail) return userEmail;

          if (role === 'student') return c.eleve_email;
          if (role === 'parent') return c.rep_legal_email;
          if (role === 'teacher') return c.prof_email;
          if (role === 'company_head') return c.ent_rep_email;
          if (role === 'tutor') return c.tuteur_email;
          if (isSchoolAdminRole(role)) return c.ecole_chef_email;
          return '';
        })() ?? ''}
        canSignDual={(() => {
          const c = conventions.find(c => c.id === selectedConventionId);
          if (!c) return false;

          // Allow Dual Signing for Company Head and Tutor roles
          if (role === 'company_head') return true;
          if (role === 'tutor') return true;

          return false;
        })()}
        dualRoleLabel={(() => {
          if (role === 'company_head') return "Je déclare être également le tuteur de cet élève";
          if (role === 'tutor') return "En cochant cette case et en complément de mon statut de tuteur, je déclare avoir pouvoir de signer pour l'entreprise. Si cette case est décochée, je signe uniquement en qualité de tuteur, le chef d'entreprise ou le représentant du chef d'entreprise signera de son côté.";
          return "";
        })()}
      />

      <ParentValidationModal
        isOpen={activeModal === 'parent'}
        onClose={() => setActiveModal(null)}
        onValidated={() => {
          setActiveModal('signature');
        }}
        convention={conventions.find(c => c.id === selectedConventionId) as Convention}
      />

      <TutorValidationModal
        isOpen={activeModal === 'tutor'}
        onClose={() => setActiveModal(null)}
        onValidated={() => {
          setActiveModal('signature');
        }}
        convention={conventions.find(c => c.id === selectedConventionId) as Convention}
      />

      <CompanyValidationModal
        isOpen={activeModal === 'establishment'}
        onClose={() => setActiveModal(null)}
        onValidated={() => {
          setActiveModal('signature');
        }}
        convention={conventions.find(c => c.id === selectedConventionId) as Convention}
      />

      {/* School Head (Chef d'établissement) */}
      <SchoolHeadValidationModal
        isOpen={activeModal === 'head'}
        onClose={() => setActiveModal(null)}
        onValidated={() => {
          setActiveModal('signature');
        }}
        convention={conventions.find(c => c.id === selectedConventionId) as Convention}
      />

      {
        isPdfModalOpen && selectedConventionId && (
          <PdfPreview
            key={`pdf-${selectedConventionId}-${conventions.find(c => c.id === selectedConventionId)?.status}-${conventions.find(c => c.id === selectedConventionId)?.updatedAt || ''}`}
            data={conventions.find(c => c.id === selectedConventionId) as Convention}
            onClose={() => setIsPdfModalOpen(false)}
          />
        )
      }

      {
        isAttestationModalOpen && selectedConventionId && (
          <AttestationModal
            isOpen={isAttestationModalOpen}
            onClose={() => setIsAttestationModalOpen(false)}
            convention={conventions.find(c => c.id === selectedConventionId) as Convention}
            currentUserEmail={userEmail}
            currentUserRole={role}
          />
        )
      }

      {
        isEmailModalOpen && selectedConventionId && (
          <EmailCorrectionModal
            isOpen={isEmailModalOpen}
            onClose={() => setIsEmailModalOpen(false)}
            roleName={emailEditRole === 'company' ? 'Entreprise' : emailEditRole === 'tutor' ? 'Tuteur' : emailEditRole}
            roleTarget={emailEditRole === 'company' ? 'company_head' : emailEditRole}
            conventionId={selectedConventionId}
            currentEmail={(() => {
              const c = conventions.find(c => c.id === selectedConventionId);
              if (!c) return '';
              if (emailEditRole === 'student' || emailEditRole === 'eleve') return c.eleve_email;
              if (emailEditRole === 'parent' || emailEditRole === 'rep_legal') return c.rep_legal_email;
              if (emailEditRole === 'company' || emailEditRole === 'company_head') return c.ent_rep_email;
              if (emailEditRole === 'tutor') return c.tuteur_email;
              return '';
            })() ?? ''}
          />
        )
      }

      {
        isTrackingModalOpen && selectedConventionId && (
          <TrackingAssignmentModal
            isOpen={isTrackingModalOpen}
            onClose={() => setIsTrackingModalOpen(false)}
            conventionId={selectedConventionId}
          />
        )
      }

      {/* ODM PREVIEW MODAL */}
      {
        odmPreviewData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl flex flex-col w-full max-w-5xl h-[90vh] overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                <h3 className="text-lg font-bold text-gray-900">
                  Aperçu Ordre de Mission - {odmPreviewData.convention.eleve_nom} {odmPreviewData.convention.eleve_prenom}
                </h3>
                <div className="flex items-center gap-2">
                  {/* Check if signed based on the current signature role constraint */}
                  {(() => {
                    const role = odmSignatureRole;
                    const conventionSignatures = odmPreviewData.convention.signatures;
                    const legacySignatureData = odmPreviewData.odm.signature_data as any;

                    const hasTeacherImg = !!odmPreviewData.odm.signature_data?.teacher?.img;
                    const hasHeadImg = !!odmPreviewData.odm.signature_data?.head?.img || !!legacySignatureData?.img || !!conventionSignatures?.head?.img || !!(conventionSignatures?.headImg as any)?.img || !!conventionSignatures?.headImg;

                    const needsTeacherSignature = role === 'teacher' && !hasTeacherImg;
                    const needsHeadSignature = role === 'head' && !hasHeadImg;

                    if (needsTeacherSignature || needsHeadSignature) {
                      return (
                        <button
                          onClick={() => setIsSigningOdm(true)}
                          className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 flex items-center gap-2 animate-pulse"
                        >
                          <PenTool className="w-4 h-4" />
                          Signer l'ordre de mission
                        </button>
                      );
                    }

                    return (
                      <button
                        onClick={() => executeDownloadOdm(odmPreviewData.odm, odmPreviewData.convention)}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
                      >
                        <FileText className="w-4 h-4" />
                        Télécharger PDF
                      </button>
                    );
                  })()}

                  <button onClick={() => setOdmPreviewData(null)} className="text-gray-500 hover:text-gray-700 ml-2">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              <div className="flex-1 bg-gray-100 overflow-hidden relative">
                <PdfRenderer
                  className="w-full h-full"
                  height="100%"
                  document={<MissionOrderPdf missionOrder={odmPreviewData.odm} convention={odmPreviewData.convention} qrCodeUrl={odmQrCodeUrl} hashCode={odmPreviewData.hashCode} />}
                />
              </div>
            </div>
          </div>
        )
      }

      {/* ODM SIGNATURE MODAL */}
      {
        isSigningOdm && odmPreviewData && (
          <SignatureModal
            isOpen={isSigningOdm}
            onClose={() => setIsSigningOdm(false)}
            onSign={handleSignOdm}
            title="Signature Ordre de Mission"
            signeeName={name}
            signeeEmail={userEmail}
            conventionId={odmPreviewData.odm.id}
            role={odmSignatureRole || 'teacher'}
            documentType="mission_order"
            hideOtp={odmSignatureRole !== 'teacher'} // OTP specifically for teacher signature as per request
          />
        )
      }


    </div >
  );
}
