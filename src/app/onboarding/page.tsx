'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useUserStore, UserRole } from '@/store/user';
import { Loader2, User, GraduationCap, School, Briefcase, Users, UserCheck, UserPlus } from 'lucide-react';

export default function OnboardingPage() {
    const { user } = useAuth();
    const { createUserProfile, fetchUserProfile, role: currentRole, birthDate: currentBirthDate } = useUserStore();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
    const [birthDateInput, setBirthDateInput] = useState('');
    const [showDateInput, setShowDateInput] = useState(false);

    useEffect(() => {
        async function loadProfile() {
            if (user) {
                await fetchUserProfile(user.uid);
                setIsLoading(false);
            }
        }
        loadProfile();
    }, [user, fetchUserProfile]);

    // Update local selected role when store role changes (initial load)
    useEffect(() => {
        if (currentRole) {
            setSelectedRole(currentRole);
            if (currentRole === 'student' && currentBirthDate) {
                setBirthDateInput(currentBirthDate);
            }
        }
    }, [currentRole, currentBirthDate]);

    const calculateAge = (dateString: string) => {
        const today = new Date();
        const birthDate = new Date(dateString);
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    const handleRoleClick = (roleId: UserRole, roleLabel: string) => {
        if (!user) return;

        // RESTRICTION: Student < 20 cannot change
        if (currentRole === 'student' && currentBirthDate) {
            const storedAge = calculateAge(currentBirthDate);

            if (storedAge < 20 && roleId !== 'student') {
                // Check if they are trying to correct it
                if (birthDateInput && birthDateInput !== currentBirthDate) {
                    const inputAge = calculateAge(birthDateInput);
                    if (inputAge >= 20) {
                        alert(`Veuillez d'abord enregistrer votre nouvelle date de naissance (${inputAge} ans) en cliquant sur le bouton "Confirmer le profil Élève" ci-dessous.`);
                        return;
                    }
                }

                alert(`Vous avez ${storedAge} ans. Vous ne pouvez pas changer de statut avant l'âge de 20 ans.`);
                return;
            }
        }

        // CONFIRMATION for others (if changing role)
        if (currentRole && currentRole !== roleId) {
            // Exception: if current is student (and we are here, means age >= 20), still confirm
            if (!window.confirm("Attention : Vous êtes sur le point de changer de statut. Confirmez-vous ce changement ?")) {
                return;
            }
        }

        // Logic for "Student" selection - require Date
        if (roleId === 'student') {
            setSelectedRole('student');
            setShowDateInput(true);
            return;
        }

        // For others, direct update
        updateProfile(roleId);
    };

    const updateProfile = async (role: UserRole, bDate?: string) => {
        setIsLoading(true);
        try {
            const name = user?.email?.split('@')[0] || 'Utilisateur'; // Simple default
            if (user) {
                await createUserProfile(user.uid, {
                    email: user.email || '',
                    role: role,
                    name: name,
                    birthDate: bDate
                });
                router.push('/');
            }
        } catch (error) {
            console.error("Failed to create profile", error);
            setIsLoading(false);
        }
    };

    const confirmStudentProfile = () => {
        if (!birthDateInput) {
            alert("Veuillez entrer votre date de naissance.");
            return;
        }
        // Verify age? No specific restriction to CREATE, only to CHANGE later. 
        updateProfile('student', birthDateInput);
    };

    if (!user && !isLoading) {
        return <div className="min-h-screen flex items-center justify-center">Redirection...</div>;
    }

    const roles = [
        { id: 'student', label: 'Élève', icon: <GraduationCap className="w-8 h-8 mb-2" />, desc: 'Je dois réaliser un stage PFMP.' },
        { id: 'teacher', label: 'Enseignant Référent/Professeur Principal', icon: <School className="w-8 h-8 mb-2" />, desc: 'Je valide les projets de PFMP.' },
        { id: 'tutor', label: 'Tuteur en Entreprise', icon: <UserCheck className="w-8 h-8 mb-2" />, desc: 'J\'encadre un stagiaire.' },
        { id: 'company_head', label: 'Chef d\'Entreprise', icon: <Briefcase className="w-8 h-8 mb-2" />, desc: 'Je signe les conventions.' },
        { id: 'company_head_tutor', label: 'Chef & Tuteur', icon: <Briefcase className="w-8 h-8 mb-2" />, desc: 'Signataire et tuteur.' },
        { id: 'school_head', label: 'Chef d\'Établissement scolaire', icon: <School className="w-8 h-8 mb-2" />, desc: 'Je dirige l\'établissement.' },
        { id: 'parent', label: 'Représentant Légal', icon: <Users className="w-8 h-8 mb-2" />, desc: 'Je signe pour mon enfant.' },
        { id: 'teacher_tracker', label: 'Enseignant référent chargé du suivi', icon: <UserPlus className="w-8 h-8 mb-2" />, desc: 'Je suis les élèves durant leur stage.' },
    ];

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="max-w-4xl w-full text-center space-y-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Confirmez votre rôle</h1>
                    <p className="mt-2 text-gray-600">Veuillez sélectionner ou confirmer votre profil.</p>
                </div>

                {isLoading ? (
                    <div className="flex justify-center">
                        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {roles.map((r) => {
                                const isSelected = selectedRole === r.id;
                                return (
                                    <button
                                        key={r.id}
                                        onClick={() => handleRoleClick(r.id as UserRole, r.label)}
                                        className={`relative p-6 rounded-xl shadow-sm border-2 transition-all flex flex-col items-center text-center group ${isSelected
                                            ? 'border-green-500 bg-green-50 ring-2 ring-green-200 ring-offset-2'
                                            : 'border-transparent bg-white hover:border-blue-500 hover:shadow-md'
                                            }`}
                                    >
                                        {isSelected && (
                                            <div className="absolute top-2 right-2 text-green-600">
                                                <div className="bg-green-100 px-2 py-0.5 rounded text-xs font-bold">ACTUEL</div>
                                            </div>
                                        )}
                                        <div className={`p-3 rounded-full transition-colors ${isSelected ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-600 group-hover:bg-blue-100'
                                            }`}>
                                            {r.icon}
                                        </div>
                                        <h3 className="mt-4 font-bold text-gray-900">{r.label}</h3>
                                        <p className="mt-2 text-sm text-gray-500">{r.desc}</p>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Date Input for Student */}
                        {showDateInput && (
                            <div className="mt-8 bg-white p-6 rounded-xl shadow-lg border border-gray-200 animate-in fade-in slide-in-from-bottom-4">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">Date de naissance</h3>
                                <p className="text-sm text-gray-500 mb-4">Obligatoire pour le profil Élève.</p>
                                <div className="flex flex-col items-center space-y-4">
                                    <input
                                        type="date"
                                        value={birthDateInput}
                                        onChange={(e) => setBirthDateInput(e.target.value)}
                                        className="border border-gray-300 rounded-md px-4 py-2 w-full max-w-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                    <button
                                        onClick={confirmStudentProfile}
                                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-full shadow-lg transition-transform hover:scale-105"
                                    >
                                        Confirmer le profil Élève
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
