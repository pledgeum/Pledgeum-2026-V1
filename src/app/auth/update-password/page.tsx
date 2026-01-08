'use client';

import { useState } from 'react';
import { updatePassword, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { validatePassword } from '@/lib/validation';
import { Loader2, Lock, LogOut, CheckCircle2 } from 'lucide-react';
import { useUserStore } from '@/store/user';

export default function UpdatePasswordPage() {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        // 1. Validate Complexity
        const validation = validatePassword(newPassword);
        if (!validation.isValid) {
            setError(validation.error);
            setLoading(false);
            return;
        }

        // 2. Validate Match
        if (newPassword !== confirmPassword) {
            setError("Les mots de passe ne correspondent pas.");
            setLoading(false);
            return;
        }

        try {
            const user = auth.currentUser;
            if (user) {
                await updatePassword(user, newPassword);

                // Confirm change to clear custom claim
                await fetch('/api/auth/confirm-password-change', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${await user.getIdToken()}`
                    }
                });

                // Success - Redirect to Dashboard
                router.push('/');
            } else {
                setError("Utilisateur non connecté.");
            }
        } catch (err: any) {
            console.error(err);
            if (err.code === 'auth/requires-recent-login') {
                setError("Par sécurité, veuillez vous reconnecter avant de changer votre mot de passe.");
            } else {
                setError("Erreur lors de la mise à jour : " + err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
        router.push('/login');
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg transition-all">

                <div className="text-center">
                    <div className="mx-auto h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                        <Lock className="h-6 w-6 text-blue-600" />
                    </div>
                    <h2 className="text-3xl font-extrabold text-gray-900">Mise à jour requise</h2>
                    <p className="mt-2 text-sm text-gray-600">
                        Pour garantir la sécurité de votre compte, veuillez mettre à jour votre mot de passe avec nos nouveaux critères.
                    </p>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <h3 className="text-sm font-medium text-blue-900 mb-2 flex items-center">
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Critères de sécurité
                    </h3>
                    <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside pl-1">
                        <li>12 caractères minimum</li>
                        <li>Au monde une majuscule et une minuscule</li>
                        <li>Au moins un chiffre</li>
                        <li>Au moins un caractère spécial</li>
                    </ul>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleUpdate}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nouveau mot de passe</label>
                            <input
                                type="password"
                                required
                                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="••••••••••••"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer le mot de passe</label>
                            <input
                                type="password"
                                required
                                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="••••••••••••"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="text-red-600 text-sm text-center bg-red-50 p-3 rounded-md border border-red-100">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-70 shadow-sm transition-all"
                    >
                        {loading ? <Loader2 className="animate-spin h-5 w-5" /> : "Mettre à jour mon mot de passe"}
                    </button>
                </form>

                <div className="text-center mt-6">
                    <button
                        onClick={handleLogout}
                        className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors"
                    >
                        <LogOut className="w-4 h-4 mr-2" />
                        Se déconnecter
                    </button>
                </div>
            </div>
        </div>
    );
}
