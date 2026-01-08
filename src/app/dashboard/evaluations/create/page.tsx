'use client';

import { EvaluationGridBuilder } from '@/components/evaluations/EvaluationGridBuilder';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function CreateEvaluationPage() {
    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-6">
                    <Link
                        href="/"
                        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 mb-4 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        Retour au tableau de bord
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900">Constructeur d'Évaluation</h1>
                    <p className="mt-1 text-gray-500">
                        Configurez la structure de grille qui sera utilisée pour noter les élèves.
                    </p>
                </div>

                <EvaluationGridBuilder />
            </div>
        </div>
    );
}
