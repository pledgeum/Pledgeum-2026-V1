import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Download, CheckCircle, Trash2, Plus, ArrowLeft, Calculator, FileDown, Lock as LockIcon } from 'lucide-react';
import QRCode from 'qrcode';
import { Convention, Absence } from '@/store/convention';
import { useConventionStore } from '@/store/convention';
import { useUserStore, UserRole } from '@/store/user';
import { isPublicHoliday } from '@/lib/holidays';
import { SignatureModal } from './SignatureModal';
import dynamic from 'next/dynamic';
import { calculateEffectiveInternshipDays } from '@/lib/calculations';
import { generateVerificationUrl } from '@/app/actions/sign';
import { calculatePfmpStats } from '@/lib/pfmp-calculations';

interface AttestationModalProps {
    isOpen: boolean;
    onClose: () => void;
    convention: Convention;
    currentUserEmail: string;
    currentUserRole: UserRole;
}

export function AttestationModal({ isOpen, onClose, convention, currentUserEmail, currentUserRole }: AttestationModalProps) {
    const { updateConvention, validateAttestation } = useConventionStore();
    const [view, setView] = useState<'document' | 'absences'>('document');
    const [absences, setAbsences] = useState<Absence[]>(convention.absences || []);
    const [isSigning, setIsSigning] = useState(false);

    // Permission Restriction: Only Tutor & Company Head can sign
    const canSign = currentUserRole === 'tutor' || currentUserRole === 'company_head' || currentUserRole === 'company_head_tutor';
    const isReadOnly = convention.attestationSigned || !canSign;

    // Document Fields
    const [docData, setDocData] = useState({
        totalJoursPayes: convention.attestation_total_jours || 0,
        totalSemaines: convention.attestation_total_semaines || 0,
        activites: convention.activites || convention.stage_activites || '',
        competences: convention.attestation_competences || '',
        gratification: convention.attestation_gratification || '0',
        faitA: convention.attestation_fait_a || convention.ent_adresse?.split(',').pop()?.trim() || 'Paris',
        holidaysEncountered: [] as string[],
        absencesCount: 0
    });

    // Local state for new absence
    const [isAdding, setIsAdding] = useState(false);
    const [newAbsence, setNewAbsence] = useState<Partial<Absence>>({ type: 'absence', duration: 7, reason: '' });

    // Calculate Total Absences
    const totalAbsenceHours = absences.reduce((sum, abs) => sum + (Number(abs.duration) || 0), 0);

    // Auto-calculate days when absences or schedule change
    useEffect(() => {
        if (!isReadOnly && (!convention.attestation_total_jours || !convention.attestation_total_semaines)) {
            const stats = calculatePfmpStats(convention as any, absences);

            setDocData(prev => ({
                ...prev,
                totalJoursPayes: stats.daysToPay,
                totalSemaines: stats.weeksForDiploma,
                holidaysEncountered: stats.holidaysFound,
                absencesCount: stats.absencesDaysCount
            }));
        }
    }, [absences, convention.stage_date_debut, convention.stage_date_fin, convention.stage_horaires, isReadOnly, convention.attestation_total_jours, convention.attestation_total_semaines]);

    // QR Code Generation
    const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
    const [hashDisplay, setHashDisplay] = useState<string>('');

    useEffect(() => {
        const init = async () => {
            if (convention.id) {
                const currentData = {
                    ...convention,
                    attestation_total_jours: docData.totalJoursPayes,
                    attestation_total_semaines: docData.totalSemaines
                };

                const { url, hashDisplay } = await generateVerificationUrl(currentData as Convention, 'attestation');
                QRCode.toDataURL(url).then(setQrCodeUrl).catch(console.error);
                setHashDisplay(hashDisplay);
            }
        };
        init();
    }, [convention.id, docData.totalJoursPayes, docData.totalSemaines, convention]);

    if (!isOpen) return null;
    if (!convention) return null;

    const handleRemoveAbsence = (id: string) => {
        if (isReadOnly) return;
        setAbsences(prev => prev.filter(a => a.id !== id));
    };

    const handleAddAbsence = () => {
        if (isReadOnly) return;
        if (!newAbsence.date) return alert('Date requise');
        const abs: Absence = {
            id: Math.random().toString(36).substr(2, 9),
            date: newAbsence.date!,
            type: newAbsence.type as 'absence' | 'retard',
            duration: Number(newAbsence.duration) || 0,
            reason: newAbsence.reason,
            reportedBy: currentUserEmail,
            reportedAt: new Date().toISOString()
        };
        setAbsences([...absences, abs]);
        setIsAdding(false);
        setNewAbsence({ type: 'absence', duration: 7, reason: '' });
    };

    const handleStartSign = async () => {
        if (isReadOnly) return;

        // Prepare the payload for saving draft attestation data
        const payload = {
            total_days_paid: docData.totalJoursPayes,
            total_weeks_diploma: docData.totalSemaines,
            absences_hours: totalAbsenceHours,
            activities: docData.activites,
            skills_evaluation: docData.competences,
            gratification_amount: docData.gratification,
            signer_name: getSigneeName(),
            signer_function: getSigneeFunction()
        };

        try {
            // Save to the new attestation API
            await fetch(`/api/conventions/${convention.id}/attestation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // Fallback: also update convention if needed for other metadata (e.g. absences list which might be in metadata)
            await updateConvention(convention.id, {
                absences,
                attestation_fait_a: docData.faitA
            });

            setIsSigning(true);
        } catch (error) {
            console.error("Error saving draft attestation:", error);
            alert("Erreur lors de la sauvegarde du brouillon");
        }
    };

    const handleSignComplete = async (method: 'canvas' | 'otp', signatureData?: string, auditLog?: any) => {
        try {
            const res = await fetch(`/api/conventions/${convention.id}/attestation/sign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    signatureImage: signatureData,
                    code: method === 'otp' ? 'OTP' : 'CANVAS',
                    auditLog: auditLog
                })
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || "Erreur lors de la signature");
            }

            // Update local state by re-fetching convention or updating store
            // For now, we can manually update the store or rely on the parent to re-fetch
            const { attestation } = await res.json();

            // We use the validateAttestation store action to sync local state correctly 
            // even if we used a direct API call for the heavy lifting.
            await validateAttestation(
                convention.id,
                totalAbsenceHours,
                signatureData,
                getSigneeName(),
                getSigneeFunction(),
                docData.totalJoursPayes,
                docData.totalSemaines
            );

            setIsSigning(false);
            onClose();
        } catch (error: any) {
            console.error("Sign error:", error);
            alert(error.message);
        }
    };

    const getSigneeName = () => {
        if (currentUserEmail === convention.tuteur_email) return convention.tuteur_nom;
        if (currentUserEmail === convention.ent_rep_email) return convention.ent_rep_nom;
        return "Signataire";
    };

    const getSigneeFunction = () => {
        if (currentUserEmail === convention.tuteur_email) return convention.tuteur_fonction;
        if (currentUserEmail === convention.ent_rep_email) return convention.ent_rep_fonction;
        return "Signataire";
    };

    // Prepare data for PDF
    const plannedHours = convention.stage_duree_heures || 0;
    const effectiveHours = Math.max(0, plannedHours - totalAbsenceHours);
    const pdfConvention = { ...convention, ...docData };

    const [isGenerating, setIsGenerating] = useState(false);

    const handleDownload = async () => {
        setIsGenerating(true);
        try {
            const { generateAttestationBlob } = await import('../pdf/CredentialPdfGenerator');
            const blob = await generateAttestationBlob(pdfConvention as any, totalAbsenceHours, qrCodeUrl, hashDisplay);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Attestation_Stage_${convention.eleve_nom.replace(/\s+/g, '_')}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Erreur lors de la génération du PDF');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[95vh] overflow-y-auto flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b bg-gray-50 rounded-t-xl sticky top-0 z-10">
                    <h3 className="font-bold text-gray-900 flex items-center">
                        {view === 'document' ? (isReadOnly ? 'Attestation de PFMP (Signée)' : 'Attestation de PFMP') : 'Gestion des Absences'}
                        {isReadOnly && <CheckCircle className="w-5 h-5 ml-2 text-green-600" />}
                    </h3>
                    <div className="flex items-center gap-2">
                        {view === 'document' && (
                            <button
                                onClick={() => setView('absences')}
                                className="text-sm bg-orange-100 text-orange-700 px-3 py-1 rounded-md font-medium hover:bg-orange-200"
                            >
                                {absences.length > 0 ? `${totalAbsenceHours}h d'absence` : 'Absences'}
                            </button>
                        )}
                        <button onClick={onClose}><X className="w-5 h-5 text-gray-500" /></button>
                    </div>
                </div>

                <div className="p-8 flex-1 overflow-y-auto">
                    {view === 'document' ? (
                        <div className="space-y-6 text-sm leading-relaxed text-gray-800 font-serif">
                            {/* Header Text */}
                            <div className="text-center font-bold text-xl text-blue-800 mb-6 uppercase">
                                ANNEXE 3 : ATTESTATION DE STAGE
                            </div>

                            <p className="text-justify text-gray-800 mb-6">
                                Conformément à l’article D. 124-9 du code de l’éducation, une attestation de stage est délivrée par l’organisme d’accueil à tout élève.
                                Ce document doit être complété et signé le dernier jour du stage par un responsable autorisé de l’entreprise d’accueil.
                                Elle est remise au lycéen stagiaire, et également remise à l’établissement scolaire.
                            </p>

                            {/* Body */}
                            <div className="space-y-6">
                                {/* Company Info */}
                                <div>
                                    <h4 className="font-bold text-blue-800 uppercase border-b border-blue-800 mb-2 pb-1">L’entreprise (ou l’organisme d’accueil)</h4>
                                    <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                                        <div className="flex"><span className="font-bold w-1/3">Nom :</span> <span>{convention.ent_nom}</span></div>
                                        <div className="flex"><span className="font-bold w-1/3">N° Siret :</span> <span>{convention.ent_siret}</span></div>
                                        <div className="flex col-span-2"><span className="font-bold w-[16.5%]">Adresse :</span> <span>{convention.ent_adresse}</span></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-8 gap-y-2 mt-2">
                                        <div className="flex"><span className="font-bold w-1/3">Représenté(e) par :</span> <span>{convention.ent_rep_nom}</span></div>
                                        <div className="flex"><span className="font-bold w-1/3">Fonction :</span> <span>{convention.ent_rep_fonction}</span></div>
                                    </div>
                                </div>

                                {/* Student Info */}
                                <div>
                                    <h4 className="font-bold text-blue-800 uppercase border-b border-blue-800 mb-2 pb-1">Atteste que l’élève</h4>
                                    <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                                        <div className="flex"><span className="font-bold w-1/3">Prénom :</span> <span>{convention.eleve_prenom}</span></div>
                                        <div className="flex"><span className="font-bold w-1/3">Nom :</span> <span>{convention.eleve_nom}</span></div>
                                        <div className="flex"><span className="font-bold w-1/3">Classe :</span> <span>{convention.eleve_classe}</span></div>
                                        <div className="flex"><span className="font-bold w-1/3">Né(e) le :</span> <span>{new Date(convention.eleve_date_naissance).toLocaleDateString()}</span></div>
                                    </div>
                                </div>

                                {/* School Info */}
                                <div>
                                    <h4 className="font-bold text-blue-800 uppercase border-b border-blue-800 mb-2 pb-1">Scolarisé dans l’établissement</h4>
                                    <div className="space-y-2">
                                        <div className="flex"><span className="font-bold w-[16.5%]">Nom :</span> <span>{convention.ecole_nom}</span></div>
                                        <div className="flex"><span className="font-bold w-[16.5%]">Adresse :</span> <span>{convention.ecole_adresse}</span></div>
                                        <div className="flex"><span className="font-bold w-[16.5%]">Chef d'étab. :</span> <span>{convention.ecole_chef_nom}</span></div>
                                    </div>
                                </div>

                                {/* Internship Details */}
                                <div>
                                    <h4 className="font-bold text-blue-800 uppercase border-b border-blue-800 mb-2 pb-1">Période de formation</h4>
                                    <div>
                                        <div className="flex items-baseline mb-2">
                                            <span className="font-bold w-[16.5%]">Dates :</span>
                                            <span>Du <strong>{new Date(convention.stage_date_debut).toLocaleDateString()}</strong> au <strong>{new Date(convention.stage_date_fin || '').toLocaleDateString()}</strong></span>
                                        </div>
                                        <div className="flex flex-col gap-3 mt-4">
                                            {/* Gratification Count */}
                                            <div className="flex items-center p-3 bg-blue-50 border border-blue-100 rounded-lg">
                                                <div className="flex-1">
                                                    <span className="font-bold text-blue-900">1. Présence pour gratification :</span>
                                                    <p className="text-xs text-blue-700 opacity-80">(Plafonné à 5 jours max par semaine calendaire)</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        disabled={isReadOnly}
                                                        className="w-16 p-1 border rounded font-bold text-center disabled:bg-white"
                                                        value={docData.totalJoursPayes}
                                                        onChange={e => setDocData({ ...docData, totalJoursPayes: Number(e.target.value) })}
                                                    />
                                                    <span className="font-medium">jours</span>
                                                </div>
                                            </div>

                                            {/* Diploma Count */}
                                            <div className="flex items-center p-3 bg-green-50 border border-green-100 rounded-lg">
                                                <div className="flex-1">
                                                    <span className="font-bold text-green-900">2. Présence pour le diplôme :</span>
                                                    <p className="text-xs text-green-700 opacity-80">(Nombre de semaines validées pour l'examen)</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        disabled={isReadOnly}
                                                        className="w-16 p-1 border rounded font-bold text-center disabled:bg-white"
                                                        value={docData.totalSemaines}
                                                        onChange={e => setDocData({ ...docData, totalSemaines: Number(e.target.value) })}
                                                    />
                                                    <span className="font-medium">semaines</span>
                                                </div>
                                            </div>

                                            {(docData.absencesCount > 0 || docData.holidaysEncountered.length > 0) && (
                                                <div className="px-3 text-xs text-gray-500 space-y-1">
                                                    {docData.absencesCount > 0 && <div>• Dont {docData.absencesCount} jour(s) d'absence</div>}
                                                    {docData.holidaysEncountered.length > 0 && <div>• Jours fériés rencontrés : {docData.holidaysEncountered.join(', ')}</div>}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Activities & Competences */}
                                <div className="mt-6 space-y-4">
                                    <p>Il/elle a réalisé les activités et mobilisé les compétences suivantes :</p>

                                    <div>
                                        <label className="block font-bold mb-1">Activités réalisées</label>
                                        <textarea
                                            disabled={isReadOnly}
                                            className="w-full p-2 border rounded bg-gray-50 focus:bg-white transition-colors disabled:bg-gray-100"
                                            rows={3}
                                            value={docData.activites}
                                            onChange={e => setDocData({ ...docData, activites: e.target.value })}
                                        />
                                    </div>

                                    <div>
                                        <label className="block font-bold mb-1">Compétences mobilisées</label>
                                        <textarea
                                            disabled={isReadOnly}
                                            className="w-full p-2 border rounded bg-yellow-50 focus:bg-white transition-colors border-yellow-200 disabled:bg-gray-100 disabled:border-gray-200"
                                            rows={3}
                                            placeholder="Ex: Travail en équipe, autonomie, respect des consignes..."
                                            value={docData.competences}
                                            onChange={e => setDocData({ ...docData, competences: e.target.value })}
                                        />
                                    </div>
                                </div>

                                {/* Gratification & Signature */}
                                <div className="mt-8 border-t pt-6">
                                    <div className="flex items-center gap-2 mb-6">
                                        <span>Gratification versée par l’entreprise ou la structure d’accueil au stagiaire le cas échéant :</span>
                                        <input
                                            type="text"
                                            disabled={isReadOnly}
                                            className="w-24 p-1 border rounded text-right disabled:bg-gray-100"
                                            value={docData.gratification}
                                            onChange={e => setDocData({ ...docData, gratification: e.target.value })}
                                        />
                                        <span>€</span>
                                    </div>

                                    <div className="flex flex-col md:flex-row justify-between items-end gap-8">
                                        <div className="flex-1 w-full">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span>Fait à</span>
                                                <input
                                                    type="text"
                                                    disabled={isReadOnly}
                                                    className="border-b border-black p-1 w-full focus:outline-none bg-transparent disabled:text-gray-600"
                                                    value={docData.faitA}
                                                    onChange={e => setDocData({ ...docData, faitA: e.target.value })}
                                                />
                                            </div>
                                            <div>le {isReadOnly && convention.attestationDate ? new Date(convention.attestationDate).toLocaleDateString() : new Date().toLocaleDateString()}</div>
                                        </div>

                                        <div className="flex-1 w-full text-center">
                                            <div className="mb-4 font-bold">Signature et cachet de l’entreprise</div>

                                            {convention.attestationSigned ? (
                                                <div className="w-full">
                                                    <div className="mb-4 p-2 bg-green-50 text-green-700 border border-green-200 rounded text-sm text-center">
                                                        <CheckCircle className="inline w-4 h-4 mr-1" />
                                                        Signé le {new Date(convention.attestationDate || '').toLocaleDateString()}
                                                    </div>
                                                    <button
                                                        onClick={handleDownload}
                                                        disabled={isGenerating}
                                                        className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded shadow-lg flex flex-col items-center justify-center gap-1 transition-colors disabled:opacity-50"
                                                    >
                                                        <FileDown className="w-6 h-6" />
                                                        <span>{isGenerating ? 'Génération...' : 'Télécharger le PDF'}</span>
                                                        <span className="text-xs font-normal opacity-80">(Officiel)</span>
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="space-y-3 w-full">
                                                    {canSign ? (
                                                        <button
                                                            onClick={handleStartSign}
                                                            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow-lg transform hover:-translate-y-0.5 transition-all flex flex-col items-center justify-center gap-1"
                                                        >
                                                            <span>✍️ Signer l'attestation</span>
                                                            <span className="text-xs font-normal opacity-80">(Annexe 3)</span>
                                                        </button>
                                                    ) : (
                                                        <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg text-orange-800 text-sm italic text-center">
                                                            L'attestation doit être signée par l'entreprise avant d'être téléchargée.
                                                        </div>
                                                    )}

                                                    <button
                                                        disabled
                                                        className="w-full py-4 bg-gray-100 text-gray-400 font-bold rounded cursor-not-allowed flex flex-col items-center justify-center gap-1 border border-dashed border-gray-300"
                                                        title="Ce document doit être signé avant téléchargement"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <LockIcon className="w-4 h-4" />
                                                            <span>Télécharger le PDF</span>
                                                        </div>
                                                        <span className="text-xs font-normal opacity-60">Signature requise</span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        // Absence View
                        <div className="space-y-6">
                            <button onClick={() => setView('document')} className="flex items-center text-gray-600 hover:text-gray-900 mb-4">
                                <ArrowLeft className="w-4 h-4 mr-1" /> Retour à l'attestation
                            </button>

                            <div className="bg-gray-50 p-4 rounded-lg">
                                <h4 className="font-semibold mb-2">Récapitulatif des Absences</h4>
                                {absences.length === 0 ? (
                                    <p className="text-gray-500 italic text-center py-4">Aucune absence signalée.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {absences.map(abs => (
                                            <div key={abs.id} className="flex justify-between items-center bg-white p-3 border rounded shadow-sm">
                                                <div>
                                                    <span className={`font-bold uppercase text-xs px-2 py-0.5 rounded mr-2 ${abs.type === 'absence' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                                                        {abs.type}
                                                    </span>
                                                    <span className="font-medium">{new Date(abs.date).toLocaleDateString()}</span>
                                                    <span className="text-gray-500 text-sm ml-2">({abs.duration}h) - {abs.reason}</span>
                                                </div>
                                                {!isReadOnly && (
                                                    <button onClick={() => handleRemoveAbsence(abs.id)} className="text-red-400 hover:text-red-700">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {!isReadOnly && (
                                    <>
                                        <div className="mt-4 flex justify-between items-center pt-4 border-t border-gray-200">
                                            <span className="font-bold text-lg">Total : {totalAbsenceHours} heures</span>
                                            <button
                                                onClick={() => setIsAdding(!isAdding)}
                                                className="text-blue-600 text-sm font-medium hover:underline flex items-center"
                                            >
                                                <Plus className="w-4 h-4 mr-1" /> Ajouter une absence
                                            </button>
                                        </div>

                                        {isAdding && (
                                            <div className="mt-4 p-4 border border-blue-100 bg-blue-50 rounded">
                                                <div className="grid grid-cols-3 gap-2 mb-2">
                                                    <input type="date" className="p-1 border rounded" onChange={e => setNewAbsence({ ...newAbsence, date: e.target.value })} />
                                                    <input type="number" placeholder="Heures" className="p-1 border rounded" onChange={e => setNewAbsence({ ...newAbsence, duration: Number(e.target.value) })} value={newAbsence.duration} />
                                                    <select className="p-1 border rounded" onChange={e => setNewAbsence({ ...newAbsence, type: e.target.value as any })}>
                                                        <option value="absence">Absence</option>
                                                        <option value="retard">Retard</option>
                                                    </select>
                                                </div>
                                                <input type="text" placeholder="Motif" className="w-full p-1 border rounded mb-2" onChange={e => setNewAbsence({ ...newAbsence, reason: e.target.value })} />
                                                <button onClick={handleAddAbsence} className="bg-blue-600 text-white px-3 py-1 rounded text-sm">Ajouter</button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Signature Modal Overlay */}
                <SignatureModal
                    isOpen={isSigning}
                    onClose={() => setIsSigning(false)}
                    onSign={handleSignComplete}
                    title="Signature de l'Attestation de PFMP"
                    signeeName={getSigneeName()}
                    signeeEmail={currentUserEmail}
                    conventionId={convention.id}
                    documentType="attestation"
                    role={currentUserRole}
                />
            </div>
        </div>
    );
}
