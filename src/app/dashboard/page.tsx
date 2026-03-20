'use client';

import { useUserStore } from '@/store/user';
import { useSession } from 'next-auth/react';
import { SchoolAdminPanelSection } from '@/components/admin/sections/SchoolAdminPanelSection';
import InternshipProgressChart from '@/components/dashboard/analytics/InternshipProgressChart';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function DashboardPage() {
    const { data: session, status } = useSession();
    const { role, uai, schoolId } = useUserStore();
    const router = useRouter();

    const loading = status === "loading";
    const user = session?.user;
    const effectiveUai = uai || schoolId;

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!user) return null;

    // Allow DDFPT, School Head, and Establishment Admin
    const isAuthorized = role === 'ddfpt' || role === 'school_head' || role === 'ESTABLISHMENT_ADMIN';

    if (!isAuthorized) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
                <h1 className="text-2xl font-bold text-red-600 mb-2">Accès Refusé</h1>
                <p className="text-gray-600 text-center max-w-md">
                    Vous n'avez pas les droits nécessaires pour accéder à cette page.
                    Cet espace est réservé aux Chefs d'Établissement et DDFPT.
                </p>
                <button
                    onClick={() => router.push('/')}
                    className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Retour à l'accueil
                </button>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto space-y-8">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Suivi de l'avancement</h2>
                    <InternshipProgressChart uai={effectiveUai || ''} />
                </div>
                
                <SchoolAdminPanelSection />
            </div>
        </main>
    );
}
