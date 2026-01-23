'use client';

import { useState } from 'react';
import { Loader2, ArrowRight, Building2, User } from 'lucide-react';
import { submitOnboarding } from '@/app/actions/onboarding';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

interface InviteFormProps {
    token: string;
    email: string;
    name: string;
    companyName: string;
    companySiret: string;
}

export function InviteForm({ token, email, name: initialName, companyName, companySiret }: InviteFormProps) {
    const [name, setName] = useState(initialName);
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('password', password);
            formData.append('phone', phone);
            formData.append('name', name);

            const res = await submitOnboarding(token, formData);

            if (res.error) {
                setError(res.error);
                setLoading(false);
                return;
            }

            if (res.customToken) {
                // Login immediately
                await signInWithCustomToken(auth, res.customToken);
                // Redirect
                if (res.redirectPath) {
                    router.push(res.redirectPath);
                } else {
                    router.push('/dashboard');
                }
            }
        } catch (err: any) {
            setError(err.message || 'Une erreur est survenue.');
            setLoading(false);
        }
    };

    return (
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-100">
            <div className="mb-8 text-center">
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <User className="w-8 h-8" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Activer mon compte Tuteur</h1>
                <p className="text-sm text-gray-500 mt-2">
                    Pour signer la convention et accéder au suivi.
                </p>
            </div>

            {/* Context Card */}
            <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-200">
                <div className="flex items-center space-x-3 text-sm text-gray-700 mb-2">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    <span className="font-semibold">{companyName}</span>
                </div>
                <div className="text-xs text-gray-500 ml-7">SIRET : {companySiret}</div>
                <div className="mt-3 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block">
                    Email associé : {email}
                </div>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Votre Nom & Prénom</label>
                    <input
                        type="text"
                        required
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone mobile (pour signature)</label>
                    <input
                        type="tel"
                        required
                        placeholder="06 12 34 56 78"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Définir un mot de passe</label>
                    <input
                        type="password"
                        required
                        minLength={6}
                        placeholder="Min. 6 caractères"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                </div>

                <div className="pt-4">
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center space-x-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {loading ? <Loader2 className="animate-spin w-5 h-5" /> : (
                            <>
                                <span>Activer et Signer</span>
                                <ArrowRight className="w-5 h-5" />
                            </>
                        )}
                    </button>
                    <p className="text-center text-xs text-gray-400 mt-4">
                        En activant ce compte, vous acceptez les CGU de Pledgeum.
                    </p>
                </div>
            </form>
        </div>
    );
}
