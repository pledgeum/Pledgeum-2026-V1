export type UserRole = 'student' | 'teacher' | 'teacher_tracker' | 'school_head' | 'company_head' | 'tutor' | 'parent' | 'company_head_tutor' | 'ddfpt' | 'business_manager' | 'assistant_manager' | 'stewardship_secretary' | 'at_ddfpt';

export interface Address {
    street: string;
    city: string;
    zipCode: string;
}

export interface LegalRepresentative {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    address?: Address;
}

export interface UserProfileData {
    firstName: string;
    lastName: string;
    birthDate?: string;
    phone?: string;
    address?: Address;
    class?: string;
    diploma?: string;
    function?: string; // Job title (e.g. Proviseur, Tuteur...)
    // Legacy fields that might still be present during migration but should be removed
    [key: string]: any;
}

export interface User {
    uid: string;
    email: string;
    role: UserRole;
    uai?: string; // Link to Establishment
    createdAt: string;
    lastConnectionAt: string;
    hasAcceptedTos: boolean;

    // The structured profile data
    profileData: UserProfileData;

    // Normalized array of legal representatives
    legalRepresentatives: LegalRepresentative[];
}
