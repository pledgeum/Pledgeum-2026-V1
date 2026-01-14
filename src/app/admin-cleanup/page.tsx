'use client';

import OneOffCleanup from '@/components/admin/OneOffCleanup';

export default function AdminCleanupPage() {
    return (
        <div className="min-h-screen bg-gray-100 py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-extrabold text-gray-900">Administration Système</h1>
                    <p className="mt-2 text-sm text-gray-600">Outils de maintenance et de correction de données</p>
                </div>
                <OneOffCleanup />
            </div>
        </div>
    );
}
