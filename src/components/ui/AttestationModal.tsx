import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Download, CheckCircle, Trash2, Plus, ArrowLeft, Calculator, FileDown } from 'lucide-react';
import { Convention, Absence } from '@/store/convention';
import { useConventionStore } from '@/store/convention';
import { useUserStore, UserRole } from '@/store/user';
import { SignatureModal } from './SignatureModal';
import dynamic from 'next/dynamic';
import { AttestationPdf } from '../pdf/AttestationPdf';
import { calculateEffectiveInternshipDays } from '@/lib/calculations';
import { isPublicHoliday } from '@/lib/holidays';
import QRCode from 'qrcode';
import { generateVerificationUrl } from '@/app/actions/sign';

// Dynamic import for PDFDownloadLink to avoid SSR issues
const PDFDownloadBtn = dynamic(
    () => import('@react-pdf/renderer').then((mod) => mod.PDFDownloadLink),
    {
        ssr: false,
        loading: () => (
            <button className="w-full py-4 bg-gray-200 text-gray-500 rounded font-bold">
                Chargement du module PDF...
            </button>
        ),
    }
);

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
        totalJours: convention.attestation_total_jours || 0,
        activites: convention.activites || convention.stage_activites || '',
        competences: convention.attestation_competences || '',
        gratification: convention.attestation_gratification || '0',
        faitA: convention.attestation_fait_a || convention.ent_adresse?.split(',').pop()?.trim() || 'Paris',
        holidaysEncountered: [] as string[], // New field for display
        absencesCount: 0 // New field for display
    });

    // Local state for new absence
    const [isAdding, setIsAdding] = useState(false);
    const [newAbsence, setNewAbsence] = useState<Partial<Absence>>({ type: 'absence', duration: 7, reason: '' });

    // Calculate Total Absences
    const totalAbsenceHours = absences.reduce((sum, abs) => sum + (Number(abs.duration) || 0), 0);

    // Auto-calculate days when absences or schedule change
    useEffect(() => {
        if (!isReadOnly && !convention.attestation_total_jours) {
            // Precise Calculation based on:
            // 1. Weekly Schedule (Grille Horaire)
            // 2. Public Holidays (Excluded)
            // 3. Absences (Excluded)

            const start = new Date(convention.stage_date_debut);
            const end = new Date(convention.stage_date_fin);
            let totalDays = 0;
            let holidaysFound: string[] = [];

            // Clone to avoid infinite loop
            const current = new Date(start);

            // Map absences to simple date strings YYYY-MM-DD for fast lookup
            // Note: Absences in store have ISO string in .date
            const absenceDates = new Set(absences.map(a => new Date(a.date).toISOString().split('T')[0]));
            let absenceDaysCount = 0;

            while (current <= end) {
                const dayOfWeek = current.getDay(); // 0 = Sun, 1 = Mon ...
                // Check Schedule
                // Map JS getDay() to our Schedule keys: 1->lundi, 2->mardi...
                // Only count if convention says it's a workday
                let isWorkDay = false;

                // Helper to check schedule hours
                const checkDay = (dayName: string) => {
                    const hours = convention.stage_horaires?.[dayName as keyof typeof convention.stage_horaires];
                    // If hours are defined and not "Repos" and duration > 0
                    if (hours && hours.matin_debut && hours.matin_fin) return true; // simplified check
                    // Or check total hours per day if available?
                    // Let's assume valid presence if any time slot is filled
                    if (hours && (hours.matin_debut !== '' || hours.apres_midi_debut !== '')) return true;
                    return false;
                };

                switch (dayOfWeek) {
                    case 1: if (checkDay('lundi')) isWorkDay = true; break;
                    case 2: if (checkDay('mardi')) isWorkDay = true; break;
                    case 3: if (checkDay('mercredi')) isWorkDay = true; break;
                    case 4: if (checkDay('jeudi')) isWorkDay = true; break;
                    case 5: if (checkDay('vendredi')) isWorkDay = true; break;
                    case 6: if (checkDay('samedi')) isWorkDay = true; break;
                    case 0: if (checkDay('dimanche')) isWorkDay = true; break;
                }

                if (isWorkDay) {
                    // Check exclusion: Public Holiday
                    if (isPublicHoliday(current)) {
                        holidaysFound.push(current.toLocaleDateString());
                    } else {
                        // Check exclusion: Absence
                        const dateStr = current.toISOString().split('T')[0];
                        if (absenceDates.has(dateStr)) {
                            absenceDaysCount++;
                        } else {
                            totalDays++;
                        }
                    }
                }

                // Next day
                current.setDate(current.getDate() + 1);
            }

            setDocData(prev => ({
                ...prev,
                totalJours: totalDays,
                holidaysEncountered: holidaysFound,
                absencesCount: absenceDaysCount
            }));
        }
    }, [absences, convention.stage_date_debut, convention.stage_date_fin, convention.stage_horaires, isReadOnly, convention.attestation_total_jours]);

    // QR Code Generation
    const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
    const [hashDisplay, setHashDisplay] = useState<string>('');

    useEffect(() => {
        const init = async () => {
            if (convention.id) {
                // Use Server Action to get signed URL
                // We pass the convention object. Note: If the user edits fields (absences, etc), 
                // the QR code might need regeneration if those fields are part of the payload.
                // The server action uses: id, student name, company, dates, status, total days.
                // 'totalJours' is edited in local state 'docData'. We should probably merge it.
                const currentData = { ...convention, attestation_total_jours: docData.totalJours };

                const { url, hashDisplay } = await generateVerificationUrl(currentData as Convention, 'attestation');
                QRCode.toDataURL(url).then(setQrCodeUrl).catch(console.error);
                setHashDisplay(hashDisplay);
            }
        };
        init();
    }, [convention.id, docData.totalJours, convention]);

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
        // Save data first
        await updateConvention(convention.id, {
            absences,
            attestation_competences: docData.competences,
            attestation_gratification: docData.gratification,
            attestation_fait_a: docData.faitA,
            attestation_total_jours: docData.totalJours,
            activites: docData.activites
        });
        setIsSigning(true);
    };

    const handleSignComplete = async (method: 'canvas' | 'otp', signatureData?: string) => {
        await validateAttestation(convention.id, totalAbsenceHours, signatureData, getSigneeName(), getSigneeFunction());
        setIsSigning(false);
        onClose();
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
                                        <div className="flex items-center">
                                            <div className="flex flex-col items-start">
                                                <div className="flex items-center">
                                                    <span className="font-bold w-[150px]">Durée effective :</span>
                                                    <input
                                                        type="number"
                                                        disabled={isReadOnly}
                                                        className="w-16 p-0.5 border rounded font-bold text-center disabled:bg-gray-100 mx-2"
                                                        value={docData.totalJours}
                                                        onChange={e => setDocData({ ...docData, totalJours: Number(e.target.value) })}
                                                    />
                                                    <span>jours de présence</span>
                                                </div>
                                                {(docData.absencesCount > 0 || docData.holidaysEncountered.length > 0) && (
                                                    <div className="ml-[158px] text-xs text-gray-500 mt-1">
                                                        {docData.absencesCount > 0 && <div>• Dont {docData.absencesCount} jour(s) d'absence</div>}
                                                        {docData.holidaysEncountered.length > 0 && <div>• Jours fériés : {docData.holidaysEncountered.join(', ')}</div>}
                                                    </div>
                                                )}
                                            </div>
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

                                            {isReadOnly ? (
                                                <div className="w-full">
                                                    <div className="mb-4 p-2 bg-green-50 text-green-700 border border-green-200 rounded text-sm text-center">
                                                        <CheckCircle className="inline w-4 h-4 mr-1" />
                                                        Signé le {new Date(convention.attestationDate || '').toLocaleDateString()}
                                                    </div>
                                                    <PDFDownloadBtn
                                                        document={<AttestationPdf convention={pdfConvention as any} totalAbsenceHours={totalAbsenceHours} qrCodeUrl={qrCodeUrl} hashCode={hashDisplay} />}
                                                        fileName={`Attestation_Stage_${convention.eleve_nom.replace(/\s+/g, '_')}.pdf`}
                                                    >
                                                        {({ loading }) => (
                                                            <button
                                                                disabled={loading}
                                                                className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded shadow-lg flex flex-col items-center justify-center gap-1 transition-colors disabled:opacity-50"
                                                            >
                                                                <FileDown className="w-6 h-6" />
                                                                <span>{loading ? 'Génération...' : 'Télécharger le PDF'}</span>
                                                                <span className="text-xs font-normal opacity-80">(Officiel)</span>
                                                            </button>
                                                        )}
                                                    </PDFDownloadBtn>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={handleStartSign}
                                                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow-lg transform hover:-translate-y-0.5 transition-all flex flex-col items-center justify-center gap-1"
                                                >
                                                    <span>✍️ Signer l'attestation</span>
                                                    <span className="text-xs font-normal opacity-80">(Annexe 3)</span>
                                                </button>
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
                />
            </div>
        </div > // Final closing tag fixed (was missing closing div in previous snippet? No, it was there.)
    ); // Return close
} // Component close
