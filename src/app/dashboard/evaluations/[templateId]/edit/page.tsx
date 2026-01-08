'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { EvaluationGridBuilder } from '@/components/evaluations/EvaluationGridBuilder';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function EditEvaluationPage() {
    const params = useParams();
    const router = useRouter();
    const templateId = Array.isArray(params?.templateId) ? params.templateId[0] : params?.templateId as string;

    const [initialData, setInitialData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (templateId) {
            const fetchTemplate = async () => {
                try {
                    const docRef = doc(db, 'evaluation_templates', templateId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        setInitialData(docSnap.data());
                    } else {
                        router.push('/dashboard/evaluations');
                    }
                } catch (error) {
                    console.error("Error fetching template:", error);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchTemplate();
        }
    }, [templateId, router]);

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!initialData) return null;

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-6">
                    <Link
                        href="/dashboard/evaluations"
                        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 mb-4 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        Retour à la liste
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900">Modifier l'Évaluation</h1>
                    <p className="mt-1 text-gray-500">
                        Modifiez la structure de votre grille d'évaluation.
                    </p>
                </div>

                <EvaluationGridBuilder
                    initialData={initialData}
                    templateId={templateId}
                    mode="edit"
                />
            </div>
        </div>
    );
}
