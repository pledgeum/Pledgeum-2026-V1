import { useUserStore } from '@/store/user';
import { useMemo } from 'react';

export type UserRole = 'student' | 'teacher' | 'teacher_tracker' | 'school_head' | 'company_head' | 'tutor' | 'parent' | 'company_head_tutor' | 'ddfpt' | 'business_manager' | 'assistant_manager' | 'stewardship_secretary' | 'at_ddfpt';

interface ProfileStatus {
    isComplete: boolean;
    missingFields: string[];
}

export const useProfileStatus = (): ProfileStatus => {
    const { role, profileData, birthDate, name, email } = useUserStore();

    return useMemo(() => {
        // BYPASS FOR SUPER ADMIN / TEST ACCOUNT
        if (email === 'pledgeum@gmail.com') {
            return { isComplete: true, missingFields: [] };
        }

        const missing: string[] = [];

        // Common checks?
        // if (!name) missing.push('name'); // Usually present from auth
        // if (!email) missing.push('email');

        const data = profileData || {};

        if (role === 'student') {
            if (!birthDate) missing.push('birthDate');
            if (!data.phone) missing.push('phone');
            if (!data.address) missing.push('address');
            if (!data.city) missing.push('city');
            if (!data.zipCode) missing.push('zipCode');
            // Class ID often mandatory for students to be assigned
            if (!data.classId && !data.classe) missing.push('classId');
        }
        else if (role === 'company_head' || role === 'tutor' || role === 'company_head_tutor') {
            if (!data.companyName) missing.push('companyName');
            if (!data.siret) missing.push('siret');
            if (!data.address) missing.push('address');
            if (!data.city) missing.push('city');
            if (!data.zipCode) missing.push('zipCode');

            // If strictly tutor or double hat, might need personal phone too
            if (!data.phone) missing.push('phone');

            // "tutorName" mentioned in prompt - usually name is enough, but maybe "fonction"?
            if (!data.function && !data.fonction) missing.push('function');
        }
        else if (role === 'teacher' || role === 'teacher_tracker') {
            // Phone is now optional for teachers
            // Subject might be optional for some, but prompt asked for it
            if (!data.subject && !data.matiere) missing.push('subject');
        }
        else if (role === 'school_head' || role === 'ddfpt' || role === 'business_manager') {
            // Admin roles usually just need contact info
            // Phone is optional for internal collaborators as data comes from invite
            // if (!data.phone) missing.push('phone');
        }
        else if (role === 'parent') {
            if (!data.phone) missing.push('phone');
            if (!data.address) missing.push('address');
            if (!data.city) missing.push('city');
            if (!data.zipCode) missing.push('zipCode');
        }

        return {
            isComplete: missing.length === 0,
            missingFields: missing
        };
    }, [role, profileData, birthDate, name, email]);
};
