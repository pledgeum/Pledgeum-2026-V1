'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Lock, Eye, EyeOff } from 'lucide-react';

function ResetPasswordContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const token = searchParams.get('token');
    const email = searchParams.get('email');

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!token || !email) {
            setStatus('error');
            setMessage('Lien de réinitialisation invalide ou manquant.');
        }
    }, [token, email]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword !== confirmPassword) {
            setMessage("Les mots de passe ne correspondent pas.");
            setStatus('error');
            return;
        }

        if (newPassword.length < 8) {
            setMessage("Le mot de passe doit contenir au moins 8 caractères.");
            setStatus('error');
            return;
        }

        setStatus('loading');
        setMessage('');

        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, token, newPassword }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Une erreur est survenue.');
            }

            setStatus('success');
            setMessage(data.message || "Votre mot de passe a été réinitialisé avec succès.");

            // Redirect after delay
            setTimeout(() => {
                router.push('/login');
            }, 3000);

        } catch (error: any) {
            console.error(error);
            setStatus('error');
            setMessage(error.message);
        }
    };

    if (status === 'success') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
                <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg text-center">
                    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                        <Lock className="h-6 w-6 text-green-600" aria-hidden="true" />
                    </div>
                    <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Mot de passe réinitialisé !</h2>
                    <p className="mt-2 text-sm text-gray-600">
                        Vous allez être redirigé vers la page de connexion dans quelques instants...
                    </p>
                    <div className="mt-6">
                        <Link href="/login" className="text-base font-medium text-blue-600 hover:text-blue-500">
                            Se connecter maintenant
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg">
                <div className="text-center">
                    <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Nouveau mot de passe</h2>
                    <p className="mt-2 text-sm text-gray-600">
                        Veuillez choisir un nouveau mot de passe sécurisé.
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div className="relative">
                            <label htmlFor="new-password" className="sr-only">Nouveau mot de passe</label>
                            <input
                                id="new-password"
                                name="new-password"
                                type={showPassword ? "text" : "password"}
                                required
                                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                placeholder="Nouveau mot de passe"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                minLength={8}
                            />
                            <button
                                type="button"
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff className="h-5 w-5 text-gray-500" /> : <Eye className="h-5 w-5 text-gray-500" />}
                            </button>
                        </div>

                        <div>
                            <label htmlFor="confirm-password" className="sr-only">Confirmer le mot de passe</label>
                            <input
                                id="confirm-password"
                                name="confirm-password"
                                type="password"
                                required
                                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                placeholder="Confirmer le mot de passe"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    {status === 'error' && (
                        <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded border border-red-100">
                            {message}
                        </div>
                    )}

                    <div>
                        <button
                            type="submit"
                            disabled={status === 'loading' || !token || !email}
                            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {status === 'loading' ? <Loader2 className="animate-spin h-5 w-5" /> : "Changer le mot de passe"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>}>
            <ResetPasswordContent />
        </Suspense>
    );
}
