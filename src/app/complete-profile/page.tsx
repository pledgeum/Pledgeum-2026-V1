'use client';

import { useEffect, useState } from 'react';
import { useUserStore, UserRole } from '@/store/user';
import { useProfileStatus } from '@/hooks/useProfileStatus';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/context/AuthContext';

// Field Configuration
interface FieldDef {
    name: string;
    label: string;
    type?: string;
    placeholder?: string;
    disabled?: boolean;
}

const ROLE_FIELDS: Partial<Record<UserRole, FieldDef[]>> = {
    student: [
        { name: 'lastName', label: 'Nom', disabled: true },
        { name: 'firstName', label: 'Prénom', disabled: true },
        { name: 'birthDate', label: 'Date de naissance', type: 'date', disabled: true },
        { name: 'phone', label: 'Téléphone', type: 'tel', placeholder: '06 12 34 56 78' },
        { name: 'address', label: 'Adresse', placeholder: '10 rue de la Paix' },
        { name: 'zipCode', label: 'Code Postal', placeholder: '75001' },
        { name: 'city', label: 'Ville', placeholder: 'Paris' },
        { name: 'classId', label: 'Classe', placeholder: 'Ex: T.SN', disabled: true }, // Set by Admin
    ],
    company_head: [
        { name: 'companyName', label: 'Raison Sociale', placeholder: 'Ma Société' },
        { name: 'siret', label: 'SIRET', placeholder: '14 chiffres sans espaces' },
        { name: 'address', label: 'Adresse du Siège' },
        { name: 'zipCode', label: 'Code Postal' },
        { name: 'city', label: 'Ville' },
        { name: 'phone', label: 'Téléphone Entreprise' },
        { name: 'tutorName', label: 'Nom du Tuteur (Défaut)', placeholder: 'Nom Prénom' },
        { name: 'function', label: 'Fonction du Tuteur (Défaut)' },
    ],
    tutor: [
        { name: 'companyName', label: 'Entreprise' }, // Might be pre-filled/read-only if invited? 
        { name: 'siret', label: 'SIRET' },
        { name: 'address', label: 'Adresse' },
        { name: 'zipCode', label: 'Code Postal' },
        { name: 'city', label: 'Ville' },
        { name: 'phone', label: 'Téléphone Mobile' },
        { name: 'function', label: 'Fonction' },
    ],
    teacher: [
        { name: 'lastName', label: 'Nom', disabled: true },
        { name: 'firstName', label: 'Prénom', disabled: true },
        { name: 'phone', label: 'Téléphone Mobile (Optionnel)' },
        { name: 'subject', label: 'Matière enseignée' }, // Still required? Prompt didn't specify, assuming yes.
    ],
    parent: [
        { name: 'phone', label: 'Téléphone Mobile' },
        { name: 'address', label: 'Adresse' },
        { name: 'zipCode', label: 'Code Postal' },
        { name: 'city', label: 'Ville' },
    ]
};

// Fallback for other roles
ROLE_FIELDS['teacher_tracker'] = ROLE_FIELDS['teacher'];
ROLE_FIELDS['company_head_tutor'] = ROLE_FIELDS['company_head']; // Superserset?

export default function CompleteProfilePage() {
    const { user } = useAuth();
    const { role, profileData, updateProfileData, birthDate, name } = useUserStore();
    const { isComplete, missingFields } = useProfileStatus();
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Setup Form
    const { register, handleSubmit, setValue, formState: { errors } } = useForm();

    // Initialize form values
    useEffect(() => {
        if (profileData) {
            Object.entries(profileData).forEach(([k, v]) => setValue(k, v));
        }
        if (birthDate) setValue('birthDate', birthDate);
    }, [profileData, birthDate, setValue]);

    const onSubmit = async (data: any) => {
        if (!user?.uid) return;
        setIsSubmitting(true);
        try {
            await updateProfileData(user.uid, data);
            // If strictly needed, verify completion again via store updated state
            // But usually safe to redirect
            router.push('/');
        } catch (error) {
            console.error("Update failed", error);
            alert("Une erreur est survenue lors de la sauvegarde.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Determine fields to show
    const fieldsToShow = (role && ROLE_FIELDS[role]) ? ROLE_FIELDS[role]! : [
        { name: 'phone', label: 'Téléphone' } // Default fallback
    ];

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <h2 className="mt-6 text-center text-3xl font-extrabold text-blue-900">
                    Vérifiez votre profil
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                    Pour garantir le bon fonctionnement des conventions, merci de compléter les informations suivantes.
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow-xl sm:rounded-lg sm:px-10 border-t-4 border-blue-600">
                    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>

                        {fieldsToShow.map((field) => {
                            const isMissing = missingFields.includes(field.name);
                            return (
                                <div key={field.name}>
                                    <label htmlFor={field.name} className="block text-sm font-medium text-gray-700">
                                        {field.label} {isMissing && <span className="text-red-500">*</span>}
                                    </label>
                                    <div className="mt-1 relative rounded-md shadow-sm">
                                        <input
                                            {...register(field.name, { required: isMissing })}
                                            // Make required only if missing? Or always required for these fields?
                                            // User said "obligatoires", so yes.
                                            id={field.name}
                                            type={field.type || 'text'}
                                            placeholder={field.placeholder}
                                            disabled={field.disabled}
                                            className={`
                                                block w-full px-3 py-2 border rounded-md focus:outline-none sm:text-sm
                                                ${field.disabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}
                                                ${isMissing
                                                    ? 'border-red-300 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500 bg-red-50'
                                                    : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'}
                                            `}
                                        />
                                    </div>
                                    {isMissing && <p className="mt-1 text-xs text-red-600">Ce champ est requis.</p>}
                                </div>
                            );
                        })}

                        <div>
                            <button
                                type="submit"
                                disabled={isSubmitting} // Can disable if fields invalid? Hook form handles preventing submit.
                                className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
                                    ${isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'}
                                `}
                            >
                                {isSubmitting ? 'Enregistrement...' : 'Accéder au Dashboard'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

