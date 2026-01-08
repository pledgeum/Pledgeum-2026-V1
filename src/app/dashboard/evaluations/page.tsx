'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, FileText, Loader2, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useUserStore } from '@/store/user';
import { useSchoolStore } from '@/store/school';
import { updateDoc, arrayUnion, arrayRemove, query, collection, getDocs, where, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { Users, Check } from 'lucide-react';

export default function EvaluationsListPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const { role } = useUserStore();
    const { classes } = useSchoolStore();
    const [evaluations, setEvaluations] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [openAssignId, setOpenAssignId] = useState<string | null>(null);

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
            return;
        }

        if (user && role) {
            if (role !== 'teacher' && role !== 'at_ddfpt') {
                router.push('/');
                toast.error("Accès non autorisé.");
                return;
            }
            fetchEvaluations();
        }
    }, [user, loading, router, role]);

    const fetchEvaluations = async () => {
        if (!user) return;
        try {
            let q;
            if (role === 'at_ddfpt') {
                q = query(collection(db, "evaluation_templates"));
            } else {
                q = query(
                    collection(db, "evaluation_templates"),
                    where("authorId", "==", user.uid)
                );
            }
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setEvaluations(data);
        } catch (error) {
            console.error("Error fetching evaluations:", error);
            toast.error("Erreur lors du chargement des évaluations.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("Voulez-vous vraiment supprimer ce modèle ?")) return;

        try {
            await deleteDoc(doc(db, "evaluation_templates", id));
            setEvaluations(evaluations.filter(e => e.id !== id));
            toast.success("Modèle supprimé.");
        } catch (error) {
            console.error("Error deleting evaluation:", error);
            toast.error("Erreur lors de la suppression.");
        }
    };

    const handleAssignClass = async (templateId: string, classId: string, isAssigned: boolean) => {
        try {
            const templateRef = doc(db, "evaluation_templates", templateId);
            if (isAssigned) {
                await updateDoc(templateRef, {
                    assignedClassIds: arrayRemove(classId)
                });
                setEvaluations(evaluations.map(e => e.id === templateId ? { ...e, assignedClassIds: (e.assignedClassIds || []).filter((id: string) => id !== classId) } : e));
                toast.success("Assignation retirée.");
            } else {
                await updateDoc(templateRef, {
                    assignedClassIds: arrayUnion(classId)
                });
                setEvaluations(evaluations.map(e => e.id === templateId ? { ...e, assignedClassIds: [...(e.assignedClassIds || []), classId] } : e));
                toast.success("Classe assignée.");
            }
        } catch (error) {
            console.error("Error updating assignment:", error);
            toast.error("Erreur lors de l'assignation.");
        }
    };

    // Filter available classes based on role
    const availableClasses = (role === 'at_ddfpt' || user?.email === 'pledgeum@gmail.com')
        ? classes
        : classes.filter(c => c.mainTeacher?.email === user?.email);

    if (loading || isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" onClick={() => setOpenAssignId(null)}>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <div className="flex items-center space-x-4 mb-2">
                        <button
                            onClick={() => router.push('/')}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Retour au tableau de bord"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        </button>
                        <h1 className="text-2xl font-bold text-gray-900">Mes Évaluations</h1>
                    </div>
                    <p className="text-gray-500 ml-11">Gérez vos modèles de grilles d'évaluation.</p>
                </div>
                <button
                    onClick={() => router.push('/dashboard/evaluations/create')}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Créer une évaluation
                </button>
            </div>

            {evaluations.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900">Aucun modèle d'évaluation</h3>
                    <p className="text-gray-500 mt-1 mb-6">Commencez par créer votre première grille d'évaluation.</p>
                    <button
                        onClick={() => router.push('/dashboard/evaluations/create')}
                        className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                    >
                        Créer maintenant
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {evaluations.map((evalItem) => (
                        <div
                            key={evalItem.id}
                            className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer group relative flex flex-col"
                            onClick={() => router.push(`/dashboard/evaluations/${evalItem.id}/edit`)} // Edit page TODO
                        >
                            <div className="absolute top-4 right-4 flex space-x-2">
                                <button
                                    onClick={(e) => handleDelete(evalItem.id, e)}
                                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                                    title="Supprimer"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2 pr-8">{evalItem.title}</h3>
                            <p className="text-sm text-gray-500 line-clamp-2 mb-4 flex-grow">
                                {evalItem.subtitle || "Aucune description"}
                            </p>

                            {/* Assignment Dropdown */}
                            <div className="mb-4 relative" onClick={(e) => e.stopPropagation()}>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenAssignId(openAssignId === evalItem.id ? null : evalItem.id);
                                    }}
                                    className="flex items-center text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-2 rounded-lg w-full justify-center transition-colors"
                                >
                                    <Users className="w-3 h-3 mr-2" />
                                    {evalItem.assignedClassIds?.length > 0
                                        ? `${evalItem.assignedClassIds.length} classe(s) assignée(s)`
                                        : "Assigner à une classe"}
                                </button>

                                {openAssignId === evalItem.id && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 z-20 max-h-60 overflow-y-auto">
                                        <div className="p-2 space-y-1">
                                            {availableClasses.length === 0 ? (
                                                <p className="text-xs text-gray-500 text-center py-2">Aucune classe disponible.</p>
                                            ) : (
                                                availableClasses.map(cls => {
                                                    const isAssigned = (evalItem.assignedClassIds || []).includes(cls.id);
                                                    return (
                                                        <button
                                                            key={cls.id}
                                                            onClick={() => handleAssignClass(evalItem.id, cls.id, isAssigned)}
                                                            className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-md transition-colors ${isAssigned ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}
                                                        >
                                                            <span className="truncate">{cls.name}</span>
                                                            {isAssigned && <Check className="w-3 h-3 text-blue-600" />}
                                                        </button>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center justify-between text-xs text-gray-400 pt-4 border-t border-gray-100 mt-auto">
                                <span>{evalItem.structure?.rows?.length || 0} critères</span>
                                <span>Créé le {evalItem.createdAt?.toDate ? new Date(evalItem.createdAt.toDate()).toLocaleDateString() : 'Récemment'}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
