'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react'; // NextAuth import
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, KeyRound, ArrowRight, CheckCircle } from 'lucide-react';
import { validatePassword } from '@/lib/validation';
import { useSchoolStore } from '@/store/school';
// import { useDemoStore } from '@/store/demo'; // Commented out if it relies on Firebase, otherwise keep

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
    const [foundStudent, setFoundStudent] = useState<any>(null);
    const [foundClassId, setFoundClassId] = useState<string | null>(null);
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [activationStep, setActivationStep] = useState<1 | 2 | 3>(1);
    const [activationOtpCode, setActivationOtpCode] = useState('');

    // Demo Mode - simplified for now
    // const { isDemoMode, openEmailModal } = useDemoStore(); 
    const isDemoMode = false; // Temporary disable if store is broken

    const router = useRouter();
    const { classes } = useSchoolStore();

    const handleDemoLogin = async () => {
        setLoading(true);
        setError(null);
        const demoEmail = 'demo_access@pledgeum.fr';
        const demoPass = 'demo1234';

        try {
            const result = await signIn('credentials', {
                redirect: false,
                email: demoEmail,
                password: demoPass,
            });

            if (result?.error) {
                setError("Échec de la connexion démo. Le compte n'existe peut-être pas encore.");
            } else {
                router.push('/');
            }
        } catch (err: any) {
            console.error("Demo Login Error:", err);
            setError("Erreur technique lors de la connexion démo.");
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const result = await signIn('credentials', {
                redirect: false,
                email,
                password,
            });

            if (result?.error) {
                console.error("Login failed:", result.error);
                setError("Échec de la connexion. Vérifiez vos identifiants.");
                return;
            }

            // Check for password change requirement if passed in session/token? 
            // For now, simple redirect.
            router.push('/');

        } catch (err: any) {
            console.error(err);
            setError("Erreur technique de connexion.");
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
                body: JSON.stringify({
                    tempId: tempId.trim(), // API now handles both Email (lower) and ID (upper)
                    tempCode: tempCode.trim()
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setFoundStudent({
                    firstName: data.user.name?.split(' ')[0] || 'Utilisateur',
                    lastName: data.user.name?.split(' ').slice(1).join(' ') || '',
                    role: data.user.role || null,
                    birthDate: data.user.birthDate || null,
                    className: data.user.className || null,
                    classId: data.user.classId || null
                });
                setFoundClassId(data.schoolId);

                if (data.user.role === 'student' || !data.user.role) {
                    setNewEmail('');
                } else {
                    setNewEmail(data.user.email || '');
                }
                setActivationStep(2);
            } else {
                // Fallback check in store (if compatible)
                let student = null;
                let classId = null;

                // Note: 'classes' from store might depend on firebase if not updated. 
                // Assuming 'classes' is safe or strictly local.
                if (classes) {
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
                }

                if (student && classId) {
                    setFoundStudent(student);
                    setFoundClassId(classId);
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

        await handleSendActivationOtp();
    };

    const handleSendActivationOtp = async () => {
        try {
            // Basic implementation reusing existing API
            const response = await fetch('/api/otp/activation/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: newEmail, purpose: 'activation' })
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || "Erreur envoi OTP");
            }

            setActivationStep(3);

        } catch (err: any) {
            console.error(err);
            setError("Impossible d'envoyer le code de vérification : " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyActivationOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const res = await fetch('/api/otp/activation/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: newEmail, code: activationOtpCode, purpose: 'activation' })
            });

            if (res.ok) {
                await performAccountCreation();
            } else {
                const data = await res.json();
                setError(data.error || "Code invalide");
                setLoading(false);
            }
        } catch (err) {
            setError("Erreur technique vérification");
            setLoading(false);
        }
    };

    const performAccountCreation = async () => {
        try {
            console.log("Starting Server-Side Activation...");

            const response = await fetch('/api/auth/activate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tempId: tempId,
                    tempCode: tempCode,
                    email: newEmail,
                    password: newPassword
                })
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                if (response.status === 409 || data.code === 'EMAIL_TAKEN' || data.error === 'EMAIL_ALREADY_IN_USE') {
                    setActivationStep(2);
                    throw new Error("Cette adresse est déjà associée à un compte.");
                }
                throw new Error(data.error || "Échec de l'activation");
            }

            console.log("Activation API Success. Logging in...");

            // Sign In with NextAuth
            const result = await signIn('credentials', {
                redirect: false,
                email: newEmail,
                password: newPassword,
            });

            if (result?.error) {
                throw new Error("Activation réussie mais connexion échouée. Veuillez vous connecter.");
            }

            router.push('/');

        } catch (err: any) {
            console.error("Activation Failed:", err);
            setError(err.message || "Erreur lors de l'activation du compte.");
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

                        <div className="text-sm text-center mt-4 hidden">
                            <Link href="/signup" className="font-medium text-blue-600 hover:text-blue-500">
                                Pas encore de compte ? S'inscrire
                            </Link>
                        </div>

                        {/* DEMO ACCESS BUTTON */}
                        <div className="mt-8 pt-6 border-t border-gray-100 hidden">
                            <button
                                type="button"
                                onClick={handleDemoLogin}
                                disabled={loading}
                                className="w-full flex justify-center items-center py-2 px-4 border border-orange-300 rounded-md shadow-sm text-sm font-medium text-orange-800 bg-orange-50 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors"
                            >
                                {loading ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : "🦁 Accès Démo (Données Fictives)"}
                            </button>
                            <p className="text-xs text-center text-gray-500 mt-2">
                                Aucune inscription requise (Compte: demo_access@pledgeum.fr / demo1234)
                            </p>
                        </div>
                    </>
                ) : (
                    <>
                        {/* ACTIVATION MODE */}
                        <div className="text-center">
                            <h2 className="mt-2 text-2xl font-bold text-indigo-900 flex justify-center items-center">
                                <KeyRound className="w-6 h-6 mr-2" />
                                Activer mon compte
                            </h2>
                            {activationStep === 1 && (
                                <p className="mt-2 text-sm text-gray-600">Entrez les identifiants reçus</p>
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
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Email académique ou Identifiant provisoire</label>
                                        <input
                                            type="text"
                                            required
                                            className="appearance-none block w-full px-3 py-2 border border-blue-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                            placeholder="Ex: f.nom@ac-normandie.fr ou DUMAFABR123"
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
                        ) : activationStep === 3 ? (
                            <form className="mt-8 space-y-6" onSubmit={handleVerifyActivationOtp}>
                                <div className="rounded-md shadow-sm space-y-3">
                                    <div className="bg-blue-50 p-4 rounded-md mb-4 text-center">
                                        <p className="text-sm text-blue-800 font-medium">
                                            Code de vérification envoyé à <br />
                                            <span className="font-bold">{newEmail}</span>
                                        </p>
                                        <p className="text-xs text-blue-600 mt-2">
                                            Vérifiez vos emails (et spams).
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Code de vérification</label>
                                        <input
                                            type="text"
                                            required
                                            className="appearance-none block w-full px-3 py-2 border border-blue-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-center tracking-[0.5em] font-mono text-lg"
                                            placeholder="XXXX"
                                            maxLength={4}
                                            value={activationOtpCode}
                                            onChange={(e) => setActivationOtpCode(e.target.value)}
                                        />
                                    </div>
                                </div>
                                {error && (
                                    <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded border border-red-100">{error}</div>
                                )}
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 shadow-md"
                                >
                                    {loading ? <Loader2 className="animate-spin h-5 w-5" /> : "Vérifier et Créer le compte"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActivationStep(2)}
                                    className="w-full text-sm text-gray-500 hover:text-gray-700 mt-2 underline"
                                >
                                    Modifier l'email
                                </button>
                            </form>
                        ) : (
                            <form className="mt-6 space-y-4" onSubmit={handleActivateAccount} autoComplete="off">
                                <input type="hidden" value="something" />
                                <div className="bg-indigo-50 p-3 rounded-md text-xs text-indigo-800 mb-4">
                                    Veuillez définir vos identifiants définitifs (Email et Mot de passe) pour accéder à votre espace.
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email personnel</label>
                                    <input
                                        type="email"
                                        required
                                        name="new_account_email_avoid_autofill"
                                        id="new_account_email"
                                        autoComplete="new-email"
                                        className="appearance-none block w-full px-3 py-2 border border-blue-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-blue-50"
                                        placeholder="votre.email@exemple.com"
                                        value={newEmail}
                                        onChange={(e) => setNewEmail(e.target.value)}
                                    />
                                    {error && error.includes('Cette adresse') && (
                                        <div className="text-red-500 text-xs mt-1 font-medium">
                                            {error}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nouveau mot de passe</label>
                                    <input
                                        type="password"
                                        required
                                        minLength={6}
                                        name="new_account_password"
                                        autoComplete="new-password"
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

                                {error && !error.includes('Cette adresse') && (
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
        </div >
    );
}
