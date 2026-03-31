'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Loader2, ShieldCheck, Eye, EyeOff, CheckCircle2 } from 'lucide-react';

function ActivationContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const token = searchParams.get('token');
    const email = searchParams.get('email');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!token || !email) {
            setStatus('error');
            setMessage("Lien d'activation invalide ou manquant. Veuillez contacter votre administrateur.");
        }
    }, [token, email]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            setMessage("Les mots de passe ne correspondent pas.");
            setStatus('error');
            return;
        }

        if (password.length < 8) {
            setMessage("Le mot de passe doit contenir au moins 8 caractères.");
            setStatus('error');
            return;
        }

        setStatus('loading');
        setMessage('');

        try {
            // 1. Activate via API
            const res = await fetch('/api/auth/collaborator-activate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, token, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Une erreur est survenue lors de l'activation.");
            }

            setStatus('success');
            setMessage("Votre compte est désormais actif ! Connexion en cours...");

            // 2. Auto-Login
            const result = await signIn('credentials', {
                redirect: false,
                email,
                password,
            });

            if (result?.error) {
                console.error("Auto-login failed:", result.error);
                router.push('/login?activated=true');
            } else {
                router.push('/');
            }

        } catch (error: any) {
            console.error(error);
            setStatus('error');
            setMessage(error.message);
        }
    };

    if (status === 'success') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
                <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl text-center border border-green-100">
                    <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100">
                        <CheckCircle2 className="h-10 w-10 text-green-600" />
                    </div>
                    <div>
                        <h2 className="mt-4 text-3xl font-bold text-gray-900 font-outfit">Compte Activé !</h2>
                        <p className="mt-2 text-gray-600">
                            Félicitations, votre espace Pledgeum est prêt.
                        </p>
                        <div className="mt-6 flex flex-col items-center">
                            <Loader2 className="h-6 w-6 text-blue-600 animate-spin mb-2" />
                            <p className="text-sm text-gray-500 italic">Redirection vers votre tableau de bord...</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl border border-gray-100 animate-in fade-in duration-500">
                <div className="text-center">
                    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-lg bg-blue-600 text-white shadow-lg mb-4">
                        <ShieldCheck className="h-7 w-7" />
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900">Finalisez votre accès</h2>
                    <p className="mt-2 text-sm text-gray-600">
                        Choisissez un mot de passe pour sécuriser votre compte <b>{email}</b>.
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-5">
                        <div className="relative">
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Nouveau mot de passe</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    className="appearance-none rounded-xl relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all sm:text-sm"
                                    placeholder="8 caractères minimum"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    minLength={8}
                                />
                                <button
                                    type="button"
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5 text-gray-400" /> : <Eye className="h-5 w-5 text-gray-400" />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Confirmez votre mot de passe</label>
                            <input
                                type="password"
                                required
                                className="appearance-none rounded-xl relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all sm:text-sm"
                                placeholder="Confirmez pour valider"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    {status === 'error' && (
                        <div className="text-red-600 text-sm font-medium text-center bg-red-50 p-3 rounded-xl border border-red-100 flex items-center justify-center italic">
                            {message}
                        </div>
                    )}

                    <div>
                        <button
                            type="submit"
                            disabled={status === 'loading' || !token || !email}
                            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 transition-all shadow-lg active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {status === 'loading' ? (
                                <Loader2 className="animate-spin h-5 w-5 mx-auto" />
                            ) : (
                                "Activer mon compte et me connecter"
                            )}
                        </button>
                    </div>
                </form>
                
                <div className="pt-2 text-center">
                    <p className="text-xs text-gray-400">
                        Propulsé par Pledgeum - Solution d'administration PFMP
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function ActivationPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-blue-600" /></div>}>
            <ActivationContent />
        </Suspense>
    );
}
