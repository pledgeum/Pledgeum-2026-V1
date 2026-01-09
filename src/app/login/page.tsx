'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, KeyRound, ArrowRight, CheckCircle } from 'lucide-react';
import { validatePassword } from '@/lib/validation';
import { useSchoolStore } from '@/store/school';
import { useUserStore } from '@/store/user';

export default function LoginPage() {
    const [mode, setMode] = useState<'login' | 'activation'>('login');

    // Login State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Activation State
    const [tempId, setTempId] = useState('');
    const [tempCode, setTempCode] = useState('');
    const [foundStudent, setFoundStudent] = useState<any>(null); // Temp storage for verified student
    const [foundClassId, setFoundClassId] = useState<string | null>(null);
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [activationStep, setActivationStep] = useState<1 | 2>(1); // 1: Verify, 2: Create Account

    const router = useRouter();
    const { classes, updateStudent } = useSchoolStore();
    const { createUserProfile } = useUserStore();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Force refresh to get custom claims
            const tokenResult = await user.getIdTokenResult(true);

            if (tokenResult.claims.mustChangePassword) {
                router.push('/auth/update-password');
                return;
            }

            // Check if current password meets new security criteria
            const validation = validatePassword(password);
            if (!validation.isValid) {
                // If weak, force update
                router.push('/auth/update-password');
                return;
            }

            router.push('/');
        } catch (err: any) {
            console.error(err);
            setError("Échec de la connexion. Vérifiez vos identifiants ou créez un compte.");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyCredentials = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const response = await fetch('/api/verify-invitation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tempId, tempCode })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Success!
                setFoundStudent({
                    firstName: data.user.name?.split(' ')[0] || 'Utilisateur',
                    lastName: data.user.name?.split(' ').slice(1).join(' ') || '',
                    role: data.user.role // Store role for later use if needed
                });
                setFoundClassId(data.schoolId || 'global-school'); // Use dummy or real ID

                // For students (or implicit role), we want the field to be empty
                if (data.user.role === 'student' || !data.user.role) {
                    setNewEmail('');
                } else {
                    setNewEmail(data.user.email || ''); // Pre-fill for collaborators
                }
                setActivationStep(2);
            } else {
                // Fallback: Check Store (for Students who are still local-only?)
                // Or just fail. Let's keep store check as fallback for STUDENTS.
                let student = null;
                let classId = null;

                for (const cls of classes) {
                    const s = cls.studentsList?.find(st =>
                        st.tempId === tempId &&
                        st.tempCode === tempCode
                    );
                    if (s) {
                        student = s;
                        classId = cls.id;
                        break;
                    }
                }

                if (student && classId) {
                    setFoundStudent(student);
                    setFoundClassId(classId);
                    // Ensure email is cleared for local fallback too
                    setNewEmail('');
                    setActivationStep(2);
                } else {
                    setError(data.error || "Identifiants invalides.");
                }
            }
        } catch (err) {
            console.error(err);
            setError("Erreur technique lors de la vérification.");
        } finally {
            setLoading(false);
        }
    };

    const handleActivateAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        if (newPassword !== confirmPassword) {
            setError("Les mots de passe ne correspondent pas.");
            setLoading(false);
            return;
        }

        const validation = validatePassword(newPassword);
        if (!validation.isValid) {
            setError(validation.error);
            setLoading(false);
            return;
        }

        const finalizeActivation = async (uid: string, email: string) => {
            await createUserProfile(uid, {
                email: email,
                role: foundStudent.role || 'student', // Use verified role (collaborator) or fallback to student
                name: `${foundStudent.firstName} ${foundStudent.lastName}`,
                // Save split name for profile completion forms
                profileData: {
                    firstName: foundStudent.firstName,
                    lastName: foundStudent.lastName,
                    email: email
                }
            });

            // 3. Update School Store with correct email (Linking)
            if (foundClassId && foundStudent) {
                updateStudent(foundClassId, foundStudent.id, { email: email });
            }

            // 4. Success -> Redirect
            router.push('/');
        };

        try {
            // 1. Create Firebase Auth User
            const userCredential = await createUserWithEmailAndPassword(auth, newEmail, newPassword);
            const user = userCredential.user;
            await finalizeActivation(user.uid, user.email || newEmail);

        } catch (err: any) {
            console.error(err);
            if (err.code === 'auth/email-already-in-use') {
                // Try logging in instead to link account
                try {
                    const userCredential = await signInWithEmailAndPassword(auth, newEmail, newPassword);
                    // If successful, link and redirect
                    await finalizeActivation(userCredential.user.uid, newEmail);
                } catch (loginErr) {
                    setError("Cet email est déjà utilisé. Si c'est votre compte, le mot de passe est incorrect. Sinon, utilisez un autre email.");
                }
            } else {
                setError("Erreur lors de la création du compte : " + err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className={`max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg transition-all ${mode === 'activation' ? 'border-2 border-indigo-100' : ''}`}>

                {mode === 'login' ? (
                    <>
                        <div className="text-center">
                            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Connexion</h2>
                            <p className="mt-2 text-sm text-gray-600">Accédez à votre espace PFMP</p>
                        </div>
                        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
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
                                        placeholder="Mot de passe"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-end">
                                <Link href="/forgot-password" className="text-sm font-medium text-blue-600 hover:text-blue-500">
                                    Mot de passe oublié ?
                                </Link>
                            </div>

                            {error && (
                                <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded border border-red-100">{error}</div>
                            )}

                            <div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-70"
                                >
                                    {loading ? <Loader2 className="animate-spin h-5 w-5" /> : "Se connecter"}
                                </button>
                            </div>
                        </form>

                        <div className="mt-6">
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-300" />
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="px-2 bg-white text-gray-500">Ou</span>
                                </div>
                            </div>

                            <div className="mt-6">
                                <button
                                    onClick={() => { setMode('activation'); setError(null); }}
                                    className="w-full flex justify-center items-center py-2 px-4 border border-indigo-300 rounded-md shadow-sm text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                                >
                                    <KeyRound className="w-4 h-4 mr-2" />
                                    J'ai un code provisoire (Première connexion)
                                </button>
                            </div>
                        </div>

                        <div className="text-sm text-center mt-4">
                            <Link href="/signup" className="font-medium text-blue-600 hover:text-blue-500">
                                Pas encore de compte ? S'inscrire
                            </Link>
                        </div>
                    </>
                ) : (
                    <>
                        {/* ACTIVATION MODE */}
                        <div className="text-center">
                            <h2 className="mt-2 text-2xl font-bold text-indigo-900 flex justify-center items-center">
                                <KeyRound className="w-6 h-6 mr-2" />
                                Activation Compte Élève
                            </h2>
                            {activationStep === 1 && (
                                <p className="mt-2 text-sm text-gray-600">Entrez les identifiants reçus (PDF)</p>
                            )}
                            {activationStep === 2 && (
                                <p className="mt-2 text-sm text-green-600 font-medium flex justify-center items-center">
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    Élève identifié : {foundStudent?.firstName} {foundStudent?.lastName}
                                </p>
                            )}
                        </div>

                        {activationStep === 1 ? (
                            <form className="mt-8 space-y-6" onSubmit={handleVerifyCredentials}>
                                <div className="rounded-md shadow-sm space-y-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Identifiant provisoire</label>
                                        <input
                                            type="text"
                                            required
                                            className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            placeholder="Ex: dupont.jean.1"
                                            value={tempId}
                                            onChange={(e) => setTempId(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Code d'accès</label>
                                        <input
                                            type="text"
                                            required
                                            className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm uppercase"
                                            placeholder="Ex: AB12CD"
                                            value={tempCode}
                                            onChange={(e) => setTempCode(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {error && (
                                    <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded border border-red-100">{error}</div>
                                )}

                                <div>
                                    <button
                                        type="submit"
                                        className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                    >
                                        Vérifier <ArrowRight className="ml-2 w-4 h-4" />
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <form className="mt-6 space-y-4" onSubmit={handleActivateAccount}>
                                <div className="bg-indigo-50 p-3 rounded-md text-xs text-indigo-800 mb-4">
                                    Veuillez définir vos identifiants définitifs (Email et Mot de passe) pour accéder à votre espace.
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email personnel</label>
                                    <input
                                        type="email"
                                        required
                                        autoComplete="off"
                                        className="appearance-none block w-full px-3 py-2 border border-blue-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-blue-50"
                                        placeholder="votre.email@exemple.com"
                                        value={newEmail}
                                        onChange={(e) => setNewEmail(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nouveau mot de passe</label>
                                    <input
                                        type="password"
                                        required
                                        minLength={6}
                                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                        placeholder="******"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer mot de passe</label>
                                    <input
                                        type="password"
                                        required
                                        minLength={6}
                                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                        placeholder="******"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                    />
                                </div>

                                {error && (
                                    <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded border border-red-100">{error}</div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 shadow-md transform transition hover:scale-[1.02]"
                                >
                                    {loading ? <Loader2 className="animate-spin h-5 w-5" /> : "Activer mon compte"}
                                </button>
                            </form>
                        )}

                        <div className="mt-4 text-center">
                            <button
                                onClick={() => { setMode('login'); setError(null); setActivationStep(1); }}
                                className="text-sm font-medium text-gray-600 hover:text-gray-900 underline"
                            >
                                Retour à la connexion classique
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
