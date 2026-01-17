'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore'; // Added imports
import { auth, db } from '@/lib/firebase';
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
        const demoEmail = 'demo_access@pledgeum.fr';
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
                    role: data.user.role || null, // Store role for later use if needed
                    birthDate: data.user.birthDate || null,
                    className: data.user.className || null,
                    classId: data.user.classId || null
                });
                setFoundClassId(data.schoolId || '9999999X'); // Default to Sandbox if undefined

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
            // Priority: INVITATION UAI
            // The invitation code dictates the CURRENT school context.
            // Even if the user exists, we SWITCH them to this new school.

            const newSchoolId = foundClassId?.split('_')[0] || "UNKNOWN"; // Extract UAI from classId (e.g. 9999999X_...)

            // 1. Fetch Existing Profile (to preserve mobility data)
            let existingProfile: any = {};
            try {
                const userDoc = await getDoc(doc(db, "users", uid));
                if (userDoc.exists()) {
                    existingProfile = userDoc.data().profileData || {};
                }
            } catch (e) {
                console.warn("Could not fetch existing profile, starting fresh.", e);
            }

            // 2. FETCH STRICT SCHOOL IDENTITY (No API Search)
            // We must rely on the School Document in Firestore which is the single source of truth
            // for the establishment that issued the codes.
            let canonicalSchoolData = {
                name: foundStudent.schoolName || existingProfile.ecole_nom || '',
                address: foundStudent.address || existingProfile.address || '',
                city: foundStudent.city || existingProfile.city || '',
                postalCode: foundStudent.postalCode || existingProfile.postalCode || ''
            };

            if (newSchoolId && newSchoolId !== 'UNKNOWN') {
                try {
                    const schoolDoc = await getDoc(doc(db, "schools", newSchoolId));
                    if (schoolDoc.exists()) {
                        const sData = schoolDoc.data();
                        canonicalSchoolData = {
                            name: sData.schoolName || canonicalSchoolData.name,
                            address: sData.schoolAddress || canonicalSchoolData.address,
                            city: sData.schoolCity || canonicalSchoolData.city,
                            postalCode: sData.schoolPostalCode || canonicalSchoolData.postalCode
                        };
                        console.log(`[Activation] Resolved Canonical School Identity for ${newSchoolId}:`, canonicalSchoolData.name);
                    }
                } catch (err) {
                    console.error("[Activation] Failed to fetch school document:", err);
                }
            }

            // 2b. FETCH CLASS IDENTITY (For Diploma)
            let classDiploma = "";
            if (foundClassId) {
                try {
                    const classDoc = await getDoc(doc(db, "classes", foundClassId));
                    if (classDoc.exists()) {
                        classDiploma = classDoc.data().diploma || "";
                        console.log(`[Activation] Resolved Class Diploma for ${foundClassId}:`, classDiploma);
                    }
                } catch (err) {
                    console.error("[Activation] Failed to fetch class document:", err);
                }
            }

            // 3. FORCE School Switch & Merge Profile
            // We KEEP Name, Phone, Address, Diploma from existing profile if available (Identity Persistence)
            // We OVERWRITE Class and School info from Invitation (Context Switch)

            const pick = (a: any, b: any) => {
                const val = (a !== undefined && a !== null && a !== '') ? a : b;
                return val === undefined ? "" : val;
            };

            // PRIORITY LOGIC: UAI 9999999X
            // If the code is from the Sandbox, we FORCE the UAI to be 9999999X.
            let safeUai = newSchoolId || "";
            if (newSchoolId === '9999999X' || email === 'fabrice.dumasdelage@gmail.com') {
                safeUai = '9999999X';
            }

            const mergedProfileData = {
                // Identity
                firstName: pick(existingProfile.firstName, foundStudent.firstName),
                lastName: pick(existingProfile.lastName, foundStudent.lastName),
                birthDate: pick(existingProfile.birthDate, foundStudent.birthDate),

                // Address & Contact
                address: pick(existingProfile.address, foundStudent.address),
                postalCode: pick(existingProfile.postalCode, foundStudent.postalCode),
                zipCode: pick(existingProfile.zipCode, foundStudent.zipCode),
                city: pick(existingProfile.city, foundStudent.city),
                phone: pick(existingProfile.phone, foundStudent.phone),

                // Academic
                diploma: classDiploma || pick(existingProfile.diploma, foundStudent.diploma),

                // FORCE NEW SCHOOL CONTEXT
                email: email || "",
                schoolId: safeUai, // Use normalized UAI
                class: foundStudent.className || existingProfile.class || "",
                uai: safeUai, // NEW: Root Level UAI Compliance

                // STRICT SCHOOL IDENTITY
                ecole_nom: canonicalSchoolData.name,
                ecole_ville: canonicalSchoolData.city,

                // Role
                role: foundStudent.role || existingProfile.role || 'student',
            };

            // Final safety net
            Object.keys(mergedProfileData).forEach(key => {
                if ((mergedProfileData as any)[key] === undefined) {
                    (mergedProfileData as any)[key] = "";
                }
            });

            await createUserProfile(uid, {
                email: email,
                role: mergedProfileData.role,
                name: `${mergedProfileData.firstName} ${mergedProfileData.lastName}`,
                birthDate: mergedProfileData.birthDate,
                profileData: mergedProfileData,
                // Pass explicit UAI to store/DB
                uai: safeUai
            } as any); // Type cast until store interface is fully updated strictly

            // Also explicitly update the root user document 'schoolId' AND 'uai' field
            // Redundant but safe for direct DB reads
            await updateDoc(doc(db, "users", uid), {
                schoolId: safeUai,
                uai: safeUai
            });

            // 4. Update School Store with correct email (Linking in the new school's sub-collection)
            if (foundClassId && foundStudent && foundStudent.id) {
                updateStudent(foundClassId, foundStudent.id, { email: email });
            }

            // 5. Success -> Redirect
            router.push('/');
        };

        try {
            // 1. Unified Account Logic: Try to Login FIRST
            // If the user exists, we just want to switch their context (School Switch).
            // If they don't exist, we create them.

            let user = auth.currentUser;
            let isExistingUser = false;

            try {
                // Attempt Login with provided credentials
                const userCredential = await signInWithEmailAndPassword(auth, newEmail, newPassword);
                user = userCredential.user;
                isExistingUser = true;
                console.log("Existing user identified and authenticated. Proceeding to context switch.");
            } catch (loginErr: any) {
                if (loginErr.code === 'auth/user-not-found' || loginErr.code === 'auth/invalid-credential') {
                    // Not found -> Create New
                    const userCredential = await createUserWithEmailAndPassword(auth, newEmail, newPassword);
                    user = userCredential.user;
                } else if (loginErr.code === 'auth/wrong-password') {
                    // Account exists but wrong password
                    setError("Un compte existe déjà avec cet email mais le mot de passe est incorrect. Veuillez utiliser votre mot de passe habituel si vous avez déjà un compte.");
                    setLoading(false);
                    return;
                } else {
                    throw loginErr; // Re-throw other errors
                }
            }

            if (!user) throw new Error("Authentication failed");

            await finalizeActivation(user.uid, user.email || newEmail);

        } catch (err: any) {
            console.error(err);
            if (err.code === 'auth/email-already-in-use') {
                // Should be caught by login attempt, but safety net
                setError("Un compte existe déjà avec cet email. Veuillez utiliser votre mot de passe habituel.");
            } else {
                setError("Erreur lors de la finalisation du compte : " + err.message);
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
