'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from "next-auth/react";
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
    finalGradeEnabled?: boolean;
}

interface EvaluationSubmission {
    id: string; // conventionId_templateId
    templateId: string;
    conventionId: string;
    studentId: string; // email or id
    answers: Record<string, Record<number, any>>; // rowId -> colIndex -> value
    tutorAnswers?: Record<string, Record<number, any>>;
    synthesis?: string;
    status?: 'DRAFT' | 'FINALIZED';
    finalGrade?: string;
    teacherSignedAt?: string;
    teacherSignatureImg?: string;
    updatedAt: any;
    updatedBy: string;
}


export default function EvaluationFillingPage() {
    const params = useParams();
    const router = useRouter();
    const { data: session, status: authStatus } = useSession();
    const loading = authStatus === "loading";
    const user = session?.user;
    const { role } = useUserStore();

    // params can be string or string[], ensuring string
    const templateId = Array.isArray(params?.templateId) ? params.templateId[0] : params?.templateId as string;
    const conventionId = Array.isArray(params?.conventionId) ? params.conventionId[0] : params?.conventionId as string;

    const [template, setTemplate] = useState<EvaluationTemplate | null>(null);
    const [convention, setConvention] = useState<Convention | null>(null);
    const [answers, setAnswers] = useState<Record<string, Record<number, any>>>({});
    const [tutorAnswers, setTutorAnswers] = useState<Record<string, Record<number, any>>>({});
    const [evaluationData, setEvaluationData] = useState<EvaluationSubmission | null | undefined>(undefined); // undefined = loading/unknown, null = not found, obj = found
    const [synthesis, setSynthesis] = useState('');
    const [finalGrade, setFinalGrade] = useState('');
    const [evalStatus, setEvalStatus] = useState<'DRAFT' | 'FINALIZED'>('DRAFT');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [readOnly, setReadOnly] = useState(false);
    const [accessDenied, setAccessDenied] = useState(false);
    const [isTeacher, setIsTeacher] = useState(false);
    const [isTutor, setIsTutor] = useState(false);

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
            // 1. Fetch Template (Migrated to PostgreSQL API)
            const templateRes = await fetch(`/api/templates`); // We fetch all or specific if we had a pure GET /[id] route, but here we can just use the GET / route and filter if needed, OR we should add a GET to /[id] 
            // Wait, we don't have a GET on /api/templates/[id] yet. Let's add it or just fetch from the list.
            // Actually, the easiest is to add a GET handler to /api/templates/[id]/route.ts
            // Let me create the GET handler first or just use the list. Using the list is safe for now as it's small, but GET /[id] is better.

            const templateResult = await fetch(`/api/templates/${templateId}`);
            if (!templateResult.ok) {
                toast.error("Template introuvable");
                router.back();
                return;
            }

            const templateDataJson = await templateResult.json();
            const data = templateDataJson.template;

            if (!data) {
                toast.error("Template introuvable");
                router.back();
                return;
            }

            // Handle both structure formats (flat or nested under 'structure')
            const headers = data?.structure?.headers || data?.headers || [];
            const rows = data?.structure?.rows || data?.rows || [];
            const synthesisEnabled = data?.synthesis?.enabled ?? data?.structure?.synthesisEnabled ?? data?.synthesisEnabled ?? false;
            const synthesisTitle = data?.synthesis?.title || data?.structure?.synthesisTitle || data?.synthesisTitle || "Synthèse globale";

            const templateData = {
                id: data.id,
                ...data,
                headers,
                rows,
                synthesisEnabled,
                synthesisTitle,
                finalGradeEnabled: data.finalGradeEnabled || data.structure?.finalGradeEnabled || false
            };

            setTemplate(templateData);

            // 2. Fetch Convention from PostgreSQL API
            const conventionResponse = await fetch(`/api/conventions/${conventionId}`);
            if (!conventionResponse.ok) {
                toast.error("Convention introuvable");
                router.back();
                return;
            }
            const { convention: conventionData } = await conventionResponse.json();
            setConvention(conventionData);

            // 3. Check Permissions
            const userEmail = user?.email || "";
            const isTestAccount = userEmail === 'pledgeum@gmail.com';

            const normalizedUserEmail = userEmail.toLowerCase().trim();
            const teacherEmail = (conventionData.prof_email || conventionData.teacherEmail || conventionData.metadata?.prof_email)?.toLowerCase().trim();
            const trackingTeacherEmail = (conventionData.prof_suivi_email || conventionData.tracking_teacher_email || conventionData.metadata?.prof_suivi_email)?.toLowerCase().trim();
            const tutorEmail = (conventionData.tutor_email || conventionData.tutorEmail || conventionData.metadata?.tuteur_email)?.toLowerCase().trim();
            const repEmail = (conventionData.ent_rep_email || conventionData.metadata?.ent_rep_email)?.toLowerCase().trim();

            const isTeacherRole = role === 'teacher' || role === 'teacher_tracker';
            const isTutorRole = role === 'tutor' || role === 'company_head' || role === 'company_head_tutor';

            const userIsTeacher = !!(isTeacherRole && (normalizedUserEmail === teacherEmail || normalizedUserEmail === trackingTeacherEmail || isTestAccount));
            const userIsTutor = !!(isTutorRole && (normalizedUserEmail === tutorEmail || normalizedUserEmail === repEmail || isTestAccount));

            setIsTeacher(userIsTeacher);
            setIsTutor(userIsTutor);

            const canView =
                role === 'school_head' ||
                role === 'ddfpt' ||
                role === 'at_ddfpt' ||
                role === 'ESTABLISHMENT_ADMIN' ||
                role === 'SUPER_ADMIN' ||
                (role === 'student' && userEmail === conventionData.studentId) ||
                userIsTeacher || userIsTutor;

            if (!canView) {
                setAccessDenied(true);
                setIsLoading(false);
                return;
            }

            // 4. Fetch Existing Submission from Postgres API
            const submissionResponse = await fetch(`/api/evaluations/${conventionId}/${templateId}`);

            if (submissionResponse.ok) {
                const submissionResult = await submissionResponse.json();

                if (submissionResult.evaluation) {
                    const data = submissionResult.evaluation as EvaluationSubmission;
                    setAnswers(data.answers || {});
                    setTutorAnswers(data.tutorAnswers || {});
                    setSynthesis(data.synthesis || '');
                    setFinalGrade(data.finalGrade || '');
                    setEvalStatus(data.status || 'DRAFT');
                    setEvaluationData(data);

                    // Global Lock if FINALIZED
                    if (data.status === 'FINALIZED') {
                        setReadOnly(true);
                    } else if (!userIsTeacher && !userIsTutor) {
                        setReadOnly(true);
                    }
                } else {
                    if (!userIsTeacher && !userIsTutor) {
                        setEvaluationData(null);
                        setReadOnly(true);
                    } else {
                        setEvaluationData({} as any);
                    }
                }
            } else {
                setEvaluationData((userIsTeacher || userIsTutor) ? {} as any : null);
                if (!userIsTeacher && !userIsTutor) setReadOnly(true);
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

    const handleSave = async (status: 'DRAFT' | 'FINALIZED' = 'DRAFT', signatureData?: any) => {
        if (readOnly || !user || !template || !convention) return;
        setIsSaving(true);
        console.log("🕵️‍♂️ [FORENSIC] FRONTEND SAVING...");
        console.log("- Status:", status);
        console.log("- Answers Keys:", Object.keys(answers));
        console.log("- Full Payload:", JSON.stringify({ answers, synthesis, finalGrade }));

        try {
            const response = await fetch(`/api/evaluations/${conventionId}/${templateId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    answers,
                    synthesis,
                    final_grade: finalGrade,
                    status: status,
                    signature: signatureData
                })
            });

            console.log("DEBUG: Save evaluation response status:", response.status);
            if (response.ok) {
                const resJson = await response.json();
                console.log("DEBUG: Save evaluation success payload:", resJson);
                console.log("DEBUG: Server reported rowCount:", resJson.debug?.rowCount);
                console.log("DEBUG: Server received answers count:", resJson.debug?.receivedAnswersCount);
            }

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || "Erreur serveur API");
            }

            toast.success(status === 'FINALIZED' ? "Évaluation finalisée et signée !" : "Évaluation sauvegardée en brouillon");
            router.push('/');
        } catch (error: any) {
            console.error("Error saving evaluation:", error);
            toast.error(error.message || "Erreur lors de la sauvegarde.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleFinalize = () => {
        if (!isTeacher) return;
        if (confirm("Voulez-vous finaliser cette évaluation ? Elle ne sera plus modifiable par quiconque.")) {
            handleSave('FINALIZED', {
                img: "SIGNATURE_CAPTURÉE",
                hash: "SIG_" + Math.random().toString(36).substr(2, 9),
                ip: "127.0.0.1"
            });
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
                        <p className="text-lg font-semibold">{(convention as any).eleve_nom || convention.metadata?.eleve_nom} { (convention as any).eleve_prenom || convention.metadata?.eleve_prenom}</p>
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-muted-foreground">Classe</h3>
                        <p className="text-lg font-semibold">{(convention as any).eleve_classe || convention.metadata?.eleve_classe}</p>
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-muted-foreground">Entreprise</h3>
                        <p className="text-lg font-semibold">{(convention as any).ent_nom || convention.metadata?.ent_nom}</p>
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
                                        const tutorValue = tutorAnswers[row.id]?.[colIndex];
                                        const isModifiedByTeacher = isTeacher && tutorValue !== undefined && cellValue !== tutorValue;

                                        return (
                                            <td key={colIndex} className="px-4 py-3 align-top relative group/cell">
                                                {isModifiedByTeacher && (
                                                    <div className="absolute -top-1 -right-1 z-10" title={`Valeur initiale du tuteur: ${tutorValue}`}>
                                                        <span className="flex h-3 w-3 rounded-full bg-orange-500 border-2 border-white shadow-sm" />
                                                    </div>
                                                )}
                                                {inputType === 'text' && (
                                                    <textarea
                                                        disabled={readOnly}
                                                        value={cellValue || ''}
                                                        onChange={(e) => handleAnswerChange(row.id, colIndex, e.target.value)}
                                                        className={`flex min-h-[60px] w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y ${isModifiedByTeacher ? 'border-orange-200 bg-orange-50/20' : 'border-input'}`}
                                                        placeholder="Votre réponse..."
                                                    />
                                                )}
                                                {inputType === 'number' && (
                                                    <input
                                                        type="number"
                                                        disabled={readOnly}
                                                        value={cellValue || ''}
                                                        onChange={(e) => handleAnswerChange(row.id, colIndex, e.target.value)}
                                                        className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${isModifiedByTeacher ? 'border-orange-200 bg-orange-50/20' : 'border-input'}`}
                                                        placeholder="0"
                                                    />
                                                )}
                                                {(inputType === 'checkbox' || inputType === 'checkbox_multi' || inputType === 'checkbox_single') && (
                                                    <div className={`flex flex-col items-center justify-center p-2 rounded-md ${isModifiedByTeacher ? 'bg-orange-50/20 ring-1 ring-orange-200' : ''}`}>
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
                                                        {isModifiedByTeacher && <span className="text-[10px] text-orange-600 mt-1 font-medium">Modifié</span>}
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

            {/* Synthesis & Final Grade Section */}
            {(template.synthesisEnabled || (template.finalGradeEnabled && isTeacher)) && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Synthesis */}
                    {template.synthesisEnabled && (
                        <div className={`rounded-lg border bg-card text-card-foreground shadow-sm p-6 space-y-4 ${template.finalGradeEnabled && isTeacher ? 'md:col-span-2' : 'md:col-span-3'}`}>
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

                    {/* Final Grade - Teacher Only */}
                    {template.finalGradeEnabled && (isTeacher || readOnly) && (
                        <div className="rounded-lg border border-purple-100 bg-purple-50/30 p-6 space-y-4">
                            <h3 className="text-lg font-semibold text-purple-900">Note Finale</h3>
                            <p className="text-xs text-purple-600 mb-2">Réservé à l'enseignant. Cette note sera figer lors de la signature.</p>
                            <input
                                type="text"
                                disabled={readOnly || !isTeacher}
                                value={finalGrade}
                                onChange={(e) => setFinalGrade(e.target.value)}
                                className="flex h-12 w-full text-center text-xl font-bold rounded-md border border-purple-200 bg-white px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:opacity-50"
                                placeholder="Note / 20"
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Signature Info if FINALIZED */}
            {evalStatus === 'FINALIZED' && evaluationData?.teacherSignedAt && (
                <div className="mt-8 p-6 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between">
                    <div>
                        <h3 className="text-green-800 font-bold flex items-center">
                            <Save className="h-5 w-5 mr-2" /> Évaluation Validée et Signée
                        </h3>
                        <p className="text-green-700 text-sm mt-1">
                            Signé par l'enseignant le {new Date(evaluationData.teacherSignedAt).toLocaleDateString('fr-FR')} à {new Date(evaluationData.teacherSignedAt).toLocaleTimeString('fr-FR')}
                        </p>
                    </div>
                    {evaluationData.teacherSignatureImg && (
                        <div className="bg-white p-2 rounded border border-green-100">
                            <img src={evaluationData.teacherSignatureImg} alt="Signature" className="h-12 w-auto grayscale" />
                        </div>
                    )}
                </div>
            )}

            {/* Spacer for floating button */}
            <div className="pb-24"></div>

            {/* Floating Action Bar */}
            {!readOnly && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-gray-200 shadow-[0_-4px_12px_-2px_rgba(0,0,0,0.1)] flex justify-end items-center z-40">
                    <div className="w-full max-w-5xl mx-auto flex justify-end gap-4 px-4">
                        <button
                            onClick={() => handleSave('DRAFT')}
                            disabled={isSaving}
                            className="flex items-center px-6 py-3 text-base font-semibold text-gray-700 bg-white border border-gray-300 rounded-full shadow-sm hover:bg-gray-50 transition-all disabled:opacity-50"
                        >
                            {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                            Sauvegarder Brouillon
                        </button>
                        
                        {isTeacher && (
                            <button
                                onClick={handleFinalize}
                                disabled={isSaving}
                                className="flex items-center px-8 py-3 text-base font-bold text-white bg-black rounded-full shadow-xl hover:bg-gray-800 transition-all hover:scale-105 disabled:opacity-50"
                            >
                                {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                                Signer et Figer
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
