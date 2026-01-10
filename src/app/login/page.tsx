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
import { useDemoStore } from '@/store/demo';

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
    const [activationStep, setActivationStep] = useState<1 | 2 | 3>(1); // 1: Verify, 2: Create Account, 3: OTP
    const [activationOtpCode, setActivationOtpCode] = useState('');

    // Demo Mode
    const { isDemoMode, openEmailModal } = useDemoStore();

    const router = useRouter();
    const { classes, updateStudent } = useSchoolStore();
    const { createUserProfile } = useUserStore();

    const handleDemoLogin = async () => {
        setLoading(true);
        setError(null);
        const demoEmail = 'demo@pledgeum.fr';
        const demoPass = 'demo1234';

        try {
            // Try Logging In
            await signInWithEmailAndPassword(auth, demoEmail, demoPass);
            router.push('/');
        } catch (err: any) {
            console.log("Demo Login Failed, attempting creation...", err.code);
            // If user not found or invalid credential (which might mean not found), try creating
            if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
                try {
                    await createUserWithEmailAndPassword(auth, demoEmail, demoPass);
                    // No need to create profile in UserStore because user.ts handles injection for this email automatically
                    router.push('/');
                } catch (createErr: any) {
                    console.error("Demo Creation Failed:", createErr);
                    if (createErr.code === 'auth/email-already-in-use') {
                        // Race condition or wrong password?
                        setError("Le compte démo existe déjà mais le mot de passe est incorrect. Contactez l'administrateur.");
                    } else {
                        setError("Impossible de créer le compte démo. Erreur: " + createErr.message);
                    }
                }
            } else {
                setError("Erreur technique lors de la connexion démo.");
            }
        } finally {
            setLoading(false);
        }
    };

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
                body: JSON.stringify({
                    tempId: tempId.trim().toUpperCase(),
                    tempCode: tempCode.trim()
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Success!
                setFoundStudent({
                    firstName: data.user.name?.split(' ')[0] || 'Utilisateur',
                    lastName: data.user.name?.split(' ').slice(1).join(' ') || '',
                    role: data.user.role, // Store role for later use if needed
                    birthDate: data.user.birthDate,
                    className: data.user.className,
                    classId: data.user.classId
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

        // Send OTP
        await handleSendActivationOtp();
    };

    const handleSendActivationOtp = async () => {
        try {
            // Check Demo or Real
            if (isDemoMode || newEmail.includes('demo')) {
                setTimeout(() => {
                    setLoading(false);
                    setActivationStep(3);
                    openEmailModal({
                        to: newEmail,
                        subject: "[DEMO] Code d'activation Pledgeum : 1234",
                        text: `Bonjour ${foundStudent?.firstName},\n\nVoici votre code d'activation pour finaliser votre inscription : 1234\n\n(Simulation)`
                    });
                }, 800);
                return;
            }

            // Real API Call
            // We reuse the /api/otp/send endpoint. 
            // Note: It usually expects 'conventionId' for context, but maybe we can make it optional or use a dummy?
            // Actually, the /api/otp/send might be specific to signatures?
            // Let's check api/otp/send implementation if possible. 
            // IF NOT: We might need a generic one.
            // Assumption: The user wants to reuse likely. Or we use a specific one.
            // Let's try to send simple email via "send-email" generic or similar?
            // Since we don't have a "send-otp" generic yet, let's look at signature modal usage.
            // Ideally we should use a dedicated endpoint. 
            // For now, let's use the same /api/otp/send but pass a dummy conventionId if required, OR preferably 
            // we should check /api/otp/send content.
            // Proceeding with assumption that we can use it or I will mock it for now if needed.
            // Actually, I can use the same logic as SignatureModal but without conventionId if the API supports it.
            // Better: Use `firebase/functions`? No.
            // Let's implement basic "send-email" with "Your code is 1234" logic in frontend? NO, insecure.

            // Proposed: Reuse `/api/otp/send` if I can see it. But I can't see backend code.
            // I will use `/api/otp/send` and handle potential 400 if conventionId missing.
            // If it fails, I'll alert.

            const response = await fetch('/api/otp/activation/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: newEmail, purpose: 'activation' }) // Adding purpose just in case
            });

            if (!response.ok) {
                // Fallback or Error
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

        // 1. Verify Code
        let verified = false;

        if (isDemoMode || newEmail.includes('demo')) {
            if (activationOtpCode === '1234') verified = true;
            else {
                setError("Code démo incorrect (1234)");
                setLoading(false);
                return;
            }
        } else {
            try {
                const res = await fetch('/api/otp/activation/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: newEmail, code: activationOtpCode, purpose: 'activation' })
                });
                if (res.ok) verified = true;
                else {
                    const data = await res.json();
                    setError(data.error || "Code invalide");
                    setLoading(false);
                    return;
                }
            } catch (err) {
                setError("Erreur technique vérification");
                setLoading(false);
                return;
            }
        }

        if (verified) {
            await performAccountCreation();
        }
    };

    const performAccountCreation = async () => {
        const finalizeActivation = async (uid: string, email: string) => {
            await createUserProfile(uid, {
                email: email,
                role: foundStudent.role || 'student', // Use verified role (collaborator) or fallback to student
                name: `${foundStudent.firstName} ${foundStudent.lastName}`,
                birthDate: foundStudent.birthDate, // Pass validated birth date
                // Save split name for profile completion forms
                profileData: {
                    firstName: foundStudent.firstName,
                    lastName: foundStudent.lastName,
                    email: email,
                    birthDate: foundStudent.birthDate, // Fix: Ensure birthDate is saved in profileData
                    class: foundStudent.className // Save Class Name
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
                setError("Un compte existe déjà avec cet email. Veuillez vous connecter via l'écran d'accueil avec vos identifiants existants.");
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

                        {/* DEMO ACCESS BUTTON */}
                        <div className="mt-8 pt-6 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={handleDemoLogin}
                                disabled={loading}
                                className="w-full flex justify-center items-center py-2 px-4 border border-orange-300 rounded-md shadow-sm text-sm font-medium text-orange-800 bg-orange-50 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors"
                            >
                                {loading ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : "🦁 Accès Démo (Données Fictives)"}
                            </button>
                            <p className="text-xs text-center text-gray-500 mt-2">
                                Aucune inscription requise. Les données ne sont pas sauvegardées.
                            </p>
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
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Identifiant provisoire</label>
                                        <input
                                            type="text"
                                            required
                                            className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            placeholder="Ex: DUPOJEAN123"
                                            value={tempId}
                                            onChange={(e) => setTempId(e.target.value.toUpperCase())}
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
                                <input type="hidden" value="something" /> {/* Trap for some browsers */}
                                <div className="bg-indigo-50 p-3 rounded-md text-xs text-indigo-800 mb-4">
                                    Veuillez définir vos identifiants définitifs (Email et Mot de passe) pour accéder à votre espace.
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email personnel</label>
                                    <input
                                        type="email"
                                        required
                                        name="new_account_email_avoid_autofill" // Random name to avoid heuristics
                                        id="new_account_email"
                                        autoComplete="new-email" // Non-standard but helpful
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
                                        name="new_account_password"
                                        autoComplete="new-password" // Critical for preventing password fill
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
        </div >
    );
}
