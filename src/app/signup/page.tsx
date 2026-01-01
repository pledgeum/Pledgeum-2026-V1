'use client';

import { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

import { useSchoolStore } from '@/store/school'; // Import store

export default function SignupPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    // Access school data for validation
    const { collaborators, classes, schoolHeadEmail } = useSchoolStore();

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // Security Check: Is this email authorized?
        const normalizedEmail = email.toLowerCase().trim();

        // 1. Check School Head
        const isHead = schoolHeadEmail && schoolHeadEmail.toLowerCase() === normalizedEmail;

        // 2. Check Collaborators
        const isCollaborator = collaborators.some(c => c.email.toLowerCase() === normalizedEmail);

        // 3. Check Teachers
        const isTeacher = classes.some(c => c.teachersList.some(t => t.email.toLowerCase() === normalizedEmail));

        // 4. Check Students
        const isStudent = classes.some(c => c.studentsList && c.studentsList.some(s => s.email.toLowerCase() === normalizedEmail));

        // 5. Special Bypass for "pledgeum@gmail.com" (Debug/Demo) - keeping it unrestricted for demo purposes if needed, OR restrict it?
        // Let's allow it for safety in this dev environment.
        const isDebug = normalizedEmail === 'pledgeum@gmail.com';

        if (!isHead && !isCollaborator && !isTeacher && !isStudent && !isDebug) {
            setLoading(false);
            setError("Inscription refusée. Votre adresse email ne figure pas dans la liste des utilisateurs autorisés par l'établissement. Veuillez contacter votre administrateur.");
            return;
        }

        try {
            await createUserWithEmailAndPassword(auth, email, password);
            router.push('/onboarding');
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
