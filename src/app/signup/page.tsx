'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { validatePassword } from '@/lib/validation';

import { useSchoolStore, CollaboratorRole } from '@/store/school'; // Import store
import { useUserStore, UserRole } from '@/store/user'; // Import UserRole and store

export default function SignupPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    // Access school data for validation
    const { collaborators, classes, schoolHeadEmail, schoolHeadName } = useSchoolStore();
    const { createUserProfile } = useUserStore();


    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // Validation Password
        const validation = validatePassword(password);
        if (!validation.isValid) {
            setLoading(false);
            setError(validation.error);
            return;
        }

        // Security Check: Is this email authorized?
        const normalizedEmail = email.toLowerCase().trim();

        // 1. Check School Head
        const isHead = schoolHeadEmail && schoolHeadEmail.toLowerCase() === normalizedEmail;

        // 2. Check Collaborators
        const isCollaborator = collaborators.some(c => c.email.toLowerCase() === normalizedEmail);

        // 3. Check Teachers
        const isTeacher = classes.some(c => c.teachersList.some(t => t.email?.toLowerCase() === normalizedEmail));

        // 4. Check Students
        const isStudent = classes.some(c => c.studentsList && c.studentsList.some(s => s.email?.toLowerCase() === normalizedEmail));

        // 5. Special Bypass
        const isDebug = normalizedEmail === 'pledgeum@gmail.com';

        if (!isHead && !isCollaborator && !isTeacher && !isStudent && !isDebug) {
            setLoading(false);
            setError("Inscription refusée. Votre adresse email ne figure pas dans la liste des utilisateurs autorisés par l'établissement. Veuillez contacter votre administrateur.");
            return;
        }

        // --- DETECT ROLE BEFORE CREATION ---
        let detectedRole: UserRole | null = null;
        let detectedName = '';
        let detectedBirthDate: string | undefined = undefined;
        let initialProfileData: Record<string, any> = {};

        // 1. Check School Head
        if (isHead) {
            detectedRole = 'school_head';
            detectedName = schoolHeadName || 'Chef d\'Établissement';
        }
        // 2. Check Collaborators
        else if (isCollaborator) {
            const collaborator = collaborators.find(c => c.email.toLowerCase() === normalizedEmail);
            if (collaborator) {
                detectedName = collaborator.name;
                const roleMap: Partial<Record<CollaboratorRole, UserRole>> = {
                    'DDFPT': 'ddfpt',
                    'BDE': 'business_manager',
                    'ADJOINT_GEST': 'assistant_manager',
                    'SEC_INTENDANCE': 'stewardship_secretary',
                    'AT_DDFPT': 'at_ddfpt'
                };
                if (collaborator.role && roleMap[collaborator.role]) {
                    detectedRole = roleMap[collaborator.role]!;
                } else {
                    detectedRole = 'teacher';
                }
            }
        }
        // 3. Check Teachers
        else if (isTeacher) {
            for (const cls of classes) {
                const t = cls.teachersList.find(t => t.email?.toLowerCase() === normalizedEmail);
                if (t) {
                    detectedRole = 'teacher';
                    detectedName = `${t.firstName} ${t.lastName}`;
                    break;
                }
            }
        }
        // 4. Check Students
        else if (isStudent) {
            for (const cls of classes) {
                const s = cls.studentsList.find(s => s.email?.toLowerCase() === normalizedEmail);
                if (s) {
                    detectedRole = 'student';
                    detectedName = `${s.firstName} ${s.lastName}`;
                    initialProfileData.class = cls.name;
                    break;
                }
            }
        }

        // 5. Debug Bypass
        if (!detectedRole && isDebug) {
            detectedRole = 'school_head';
            detectedName = 'Super Admin';
        }

        if (!detectedRole) {
            setLoading(false);
            setError("Impossible de déterminer votre rôle.");
            return;
        }

        try {
            // REGISTER API CALL
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    password,
                    role: detectedRole,
                    name: detectedName,
                    profileData: initialProfileData,
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Erreur lors de l'inscription.");
            }

            // AUTO LOGIN
            const result = await signIn('credentials', {
                redirect: false,
                email,
                password,
            });

            if (result?.error) {
                throw new Error("Inscription réussie mais connexion échouée.");
            }

            router.push('/');

        } catch (err: any) {
            console.error(err);
            setError("Échec de l'inscription. " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg">
                <div className="text-center">
                    <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Créer un compte</h2>
                    <p className="mt-2 text-sm text-gray-600">Commencez à gérer vos conventions PFMP</p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleSignup}>
                    <div className="rounded-md shadow-sm -space-y-px">
                        <div>
                            <input
                                type="email"
                                required
                                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                placeholder="Adresse Email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div>
                            <input
                                type="password"
                                required
                                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                placeholder="Mot de passe (6 caracs min)"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="text-red-500 text-sm text-center">{error}</div>
                    )}

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-70"
                        >
                            {loading ? <Loader2 className="animate-spin h-5 w-5" /> : "S'inscrire"}
                        </button>
                    </div>

                    <div className="text-sm text-center">
                        <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
                            Déjà un compte ? Se connecter
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
