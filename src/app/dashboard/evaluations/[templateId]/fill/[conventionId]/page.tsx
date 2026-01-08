'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useUserStore } from '@/store/user';
import { toast } from 'sonner';
import { Loader2, Save, ArrowLeft, AlertCircle } from 'lucide-react';
import { Convention } from '@/store/convention';

interface EvaluationTemplate {
    id: string;
    title: string;
    subtitle: string;
    headers: string[];
    rows: {
        id: number;
        cells: string[];
        type?: 'text' | 'number' | 'checkbox' | 'checkbox_single' | 'checkbox_multi';
    }[];
    synthesisEnabled?: boolean;
    synthesisTitle?: string;
}

interface EvaluationSubmission {
    id: string; // conventionId_templateId
    templateId: string;
    conventionId: string;
    studentId: string; // email or id
    answers: Record<string, Record<number, any>>; // rowId -> colIndex -> value
    synthesis?: string;
    updatedAt: any;
    updatedBy: string;
}

export default function EvaluationFillingPage() {
    const params = useParams();
    const router = useRouter();
    const { user, loading } = useAuth();
    const { role } = useUserStore();

    // params can be string or string[], ensuring string
    const templateId = Array.isArray(params?.templateId) ? params.templateId[0] : params?.templateId as string;
    const conventionId = Array.isArray(params?.conventionId) ? params.conventionId[0] : params?.conventionId as string;

    const [template, setTemplate] = useState<EvaluationTemplate | null>(null);
    const [convention, setConvention] = useState<Convention | null>(null);
    const [answers, setAnswers] = useState<Record<string, Record<number, any>>>({});
    const [evaluationData, setEvaluationData] = useState<EvaluationSubmission | null | undefined>(undefined); // undefined = loading/unknown, null = not found, obj = found
    const [synthesis, setSynthesis] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [readOnly, setReadOnly] = useState(false);
    const [accessDenied, setAccessDenied] = useState(false);

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
            return;
        }
        if (user && templateId && conventionId) {
            fetchData();
        }
    }, [user, loading, templateId, conventionId]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // 1. Fetch Template
            const templateRef = doc(db, 'evaluation_templates', templateId);
            const templateSnap = await getDoc(templateRef);
            if (!templateSnap.exists()) {
                toast.error("Template introuvable");
                router.back();
                return;
            }
            const data = templateSnap.data();
            // Handle both structure formats (flat or nested under 'structure')
            // Older templates might be flat, newer are nested.
            const headers = data.structure?.headers || data.headers || [];
            const rows = data.structure?.rows || data.rows || [];
            const synthesisEnabled = data.synthesis?.enabled ?? data.structure?.synthesisEnabled ?? data.synthesisEnabled ?? false;
            const synthesisTitle = data.synthesis?.title || data.structure?.synthesisTitle || data.synthesisTitle || "Synthèse globale";

            const templateData = {
                id: templateSnap.id,
                ...data,
                headers,
                rows,
                synthesisEnabled,
                synthesisTitle
            } as EvaluationTemplate;

            setTemplate(templateData);

            // 2. Fetch Convention
            const conventionRef = doc(db, 'conventions', conventionId);
            const conventionSnap = await getDoc(conventionRef);
            if (!conventionSnap.exists()) {
                toast.error("Convention introuvable");
                router.back();
                return;
            }
            const conventionData = { id: conventionSnap.id, ...conventionSnap.data() } as Convention;
            setConvention(conventionData);

            // 3. Check Permissions
            const userEmail = user?.email;
            const isTestAccount = userEmail === 'pledgeum@gmail.com';

            // Refined Can Edit Logic: Restricted strictly to involved roles OR Test Account actively in those roles
            const isTeacher = role === 'teacher' || role === 'teacher_tracker';
            const isTutor = role === 'tutor' || role === 'company_head';

            const canEdit =
                (isTeacher && (userEmail === conventionData.prof_email || userEmail === conventionData.prof_suivi_email || isTestAccount)) ||
                (isTutor && (userEmail === conventionData.tuteur_email || userEmail === conventionData.ent_rep_email || isTestAccount)) ||
                (isTestAccount && (role === 'teacher' || role === 'tutor' || role === 'teacher_tracker'));

            const canView =
                role === 'school_head' ||
                role === 'ddfpt' ||
                role === 'at_ddfpt' ||
                (role === 'student' && userEmail === conventionData.studentId) ||
                canEdit;

            if (!canView) {
                setAccessDenied(true);
                setIsLoading(false);
                return;
            }

            if (!canEdit) {
                setReadOnly(true);
            }

            // 4. Fetch Existing Submission
            const submissionId = `${conventionId}_${templateId}`;
            const submissionRef = doc(db, 'evaluations', submissionId);
            const submissionSnap = await getDoc(submissionRef);

            if (submissionSnap.exists()) {
                const data = submissionSnap.data() as EvaluationSubmission;
                setAnswers(data.answers || {});
                setSynthesis(data.synthesis || '');
                setEvaluationData(data);
            } else {
                if (!canEdit) {
                    // Viewer trying to view non-existent evaluation -> Empty State
                    setEvaluationData(null);
                } else {
                    // Editor creating new evaluation -> Initial State
                    setEvaluationData({} as any);
                }
            }

        } catch (error) {
            console.error("Error fetching data:", error);
            toast.error("Erreur lors du chargement.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAnswerChange = (rowId: number, colIndex: number, value: any) => {
        if (readOnly) return;

        const row = template?.rows?.find(r => r.id === rowId);
        // Default behavior
        let newRowAnswers = { ...answers[rowId] };

        // Logic for single choice checkbox
        if (row?.type === 'checkbox_single' && value === true) {
            // Uncheck all other columns in this row
            Object.keys(newRowAnswers).forEach(key => {
                newRowAnswers[parseInt(key)] = false;
            });
        }

        // Apply new value
        newRowAnswers[colIndex] = value;

        setAnswers(prev => ({
            ...prev,
            [rowId]: newRowAnswers
        }));
    };

    const handleSave = async () => {
        if (readOnly || !user || !template || !convention) return;
        setIsSaving(true);
        try {
            const submissionId = `${conventionId}_${templateId}`;
            const submissionRef = doc(db, 'evaluations', submissionId);

            const submissionData: EvaluationSubmission = {
                id: submissionId,
                templateId,
                conventionId,
                studentId: convention.studentId,
                answers,
                synthesis,
                updatedAt: serverTimestamp(),
                updatedBy: user.uid
            };

            await setDoc(submissionRef, submissionData, { merge: true });
            toast.success("Évaluation sauvegardée");
            router.push('/');
        } catch (error) {
            console.error("Error saving evaluation:", error);
            toast.error("Erreur lors de la sauvegarde.");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    if (accessDenied) {
        return (
            <div className="flex flex-col items-center justify-center h-screen gap-4">
                <AlertCircle className="h-12 w-12 text-destructive" />
                <h1 className="text-xl font-bold">Accès non autorisé</h1>
                <p className="text-muted-foreground">Vous n'avez pas les droits pour voir ou modifier cette évaluation.</p>
                <button onClick={() => router.push('/')} className="text-primary hover:underline">Retour au tableau de bord</button>
            </div>
        );
    }

    // Handle Case: Viewer accessing uncompleted evaluation
    if (readOnly && evaluationData === null && !isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                <AlertCircle className="w-12 h-12 text-gray-300 mb-4" />
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Évaluation non complétée</h2>
                <p className="text-gray-500 mb-6">L'enseignant ou le tuteur n'a pas encore rempli cette évaluation.</p>
                <button onClick={() => router.push('/')} className="text-blue-600 hover:underline">
                    Retour au tableau de bord
                </button>
            </div>
        );
    }

    if (!template || !convention) {
        return <div>Données manquantes.</div>;
    }

    return (
        <div className="container mx-auto max-w-5xl py-8 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <button onClick={() => router.back()} className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-2">
                        <ArrowLeft className="h-4 w-4 mr-1" /> Retour
                    </button>
                    <h1 className="text-3xl font-bold tracking-tight">{template.title}</h1>
                    {template.subtitle && <p className="text-muted-foreground mt-1">{template.subtitle}</p>}
                </div>

            </div>

            {/* Context Card (Student Info) */}
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <h3 className="text-sm font-medium text-muted-foreground">Élève</h3>
                        <p className="text-lg font-semibold">{convention.eleve_nom} {convention.eleve_prenom}</p>
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-muted-foreground">Classe</h3>
                        <p className="text-lg font-semibold">{convention.eleve_classe}</p>
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-muted-foreground">Entreprise</h3>
                        <p className="text-lg font-semibold">{convention.ent_nom}</p>
                    </div>
                </div>
            </div>

            {/* Evaluation Grid */}
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 text-muted-foreground font-medium">
                            <tr className="border-b">
                                {(template.headers || []).map((header, index) => (
                                    <th key={index} className="px-4 py-3 min-w-[150px] first:min-w-[250px] first:pl-6 last:pr-6">
                                        {header || `Colonne ${index + 1}`}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {(template.rows || []).map((row) => (
                                <tr key={row.id} className="hover:bg-muted/5 transition-colors">
                                    {/* Column 0: Label (Text, Read-only from Template) */}
                                    <td className="px-4 py-3 pl-6 font-medium align-top">
                                        <div className="whitespace-pre-wrap">{row.cells[0]}</div>
                                    </td>

                                    {/* Other Columns: Inputs */}
                                    {(template.headers || []).slice(1).map((_, i) => {
                                        const colIndex = i + 1;
                                        const inputType = row.type || 'text';
                                        const cellValue = answers[row.id]?.[colIndex];

                                        return (
                                            <td key={colIndex} className="px-4 py-3 align-top">
                                                {inputType === 'text' && (
                                                    <textarea
                                                        disabled={readOnly}
                                                        value={cellValue || ''}
                                                        onChange={(e) => handleAnswerChange(row.id, colIndex, e.target.value)}
                                                        className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                                                        placeholder="Votre réponse..."
                                                    />
                                                )}
                                                {inputType === 'number' && (
                                                    <input
                                                        type="number"
                                                        disabled={readOnly}
                                                        value={cellValue || ''}
                                                        onChange={(e) => handleAnswerChange(row.id, colIndex, e.target.value)}
                                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                        placeholder="0"
                                                    />
                                                )}
                                                {(inputType === 'checkbox' || inputType === 'checkbox_multi' || inputType === 'checkbox_single') && (
                                                    <div className="flex justify-center pt-2">
                                                        {inputType === 'checkbox_single' ? (
                                                            <div
                                                                onClick={() => !readOnly && handleAnswerChange(row.id, colIndex, !cellValue)}
                                                                className={`h-5 w-5 rounded-full border-2 border-gray-500 cursor-pointer flex items-center justify-center ${cellValue ? 'bg-black border-black' : 'bg-white hover:border-black'} ${readOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                            >
                                                                {cellValue && <div className="h-2 w-2 rounded-full bg-white" />}
                                                            </div>
                                                        ) : (
                                                            <input
                                                                type="checkbox"
                                                                disabled={readOnly}
                                                                checked={!!cellValue}
                                                                onChange={(e) => handleAnswerChange(row.id, colIndex, e.target.checked)}
                                                                className="h-5 w-5 rounded border-gray-500 text-black focus:ring-black disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                                                            />
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Synthesis Section */}
            {template.synthesisEnabled && (
                <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 space-y-4">
                    <h3 className="text-lg font-semibold">{template.synthesisTitle || "Synthèse globale"}</h3>
                    <textarea
                        disabled={readOnly}
                        value={synthesis}
                        onChange={(e) => setSynthesis(e.target.value)}
                        className="flex min-h-[150px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="Observation générale, points forts, points à améliorer..."
                    />
                </div>
            )}

            {/* Spacer for floating button */}
            <div className="pb-24"></div>

            {/* Floating Action Bar */}
            {!readOnly && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] flex justify-end items-center z-40 md:bg-transparent md:border-none md:shadow-none md:pointer-events-none">
                    <div className="w-full max-w-5xl mx-auto flex justify-end px-4 md:px-0 pointer-events-auto">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center px-6 py-3 text-base font-bold text-white bg-blue-600 border border-transparent rounded-full shadow-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                            Sauvegarder l'évaluation
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
