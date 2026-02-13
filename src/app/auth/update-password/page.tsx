
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

export default function UpdatePasswordPage() {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { update } = useSession(); // Used to update session client-side

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirm) {
            setError('Les mots de passe ne correspondent pas.');
            return;
        }

        if (password.length < 8) {
            setError('Le mot de passe doit faire au moins 8 caractères.');
            return;
        }

        setLoading(true);

        try {
            const res = await fetch('/api/auth/update-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Erreur lors de la mise à jour.');
            }

            // Force session update to reflect must_change_password = false
            await update({ must_change_password: false });

            // Redirect to dashboard
            router.push('/');
            router.refresh();

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
            <div className="w-full max-w-md space-y-8 bg-white p-8 shadow-lg rounded-xl border border-gray-100">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
                        Sécurisez votre compte
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        C'est votre première connexion. Veuillez définir un nouveau mot de passe personnel.
                    </p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <input type="hidden" name="remember" value="true" />
                    <div className="-space-y-px rounded-md shadow-sm">
                        <div className="mb-4">
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Nouveau mot de passe</label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                className="relative block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3"
                                placeholder="Nouveau mot de passe"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                        <div>
                            <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">Confirmer mot de passe</label>
                            <input
                                id="confirm-password"
                                name="confirm-password"
                                type="password"
                                required
                                className="relative block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3"
                                placeholder="Confirmer mot de passe"
                                value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="text-red-500 text-sm text-center">
                            {error}
                        </div>
                    )}

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="group relative flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
                        >
                            {loading ? 'Mise à jour...' : 'Mettre à jour mon mot de passe'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
