import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Download, CheckCircle, Trash2, Plus, ArrowLeft, Calculator, FileDown } from 'lucide-react';
import { Convention, Absence } from '@/store/convention';
import { useConventionStore } from '@/store/convention';
import { useUserStore, UserRole } from '@/store/user';
import { SignatureModal } from './SignatureModal';
import dynamic from 'next/dynamic';
import { AttestationPdf } from '../pdf/AttestationPdf';
import { calculateEffectiveInternshipDays } from '@/lib/calculations';
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
        faitA: convention.attestation_fait_a || convention.ent_adresse?.split(',').pop()?.trim() || 'Paris'
    });

    // Local state for new absence
    const [isAdding, setIsAdding] = useState(false);
    const [newAbsence, setNewAbsence] = useState<Partial<Absence>>({ type: 'absence', duration: 7, reason: '' });

    // Calculate Total Absences
    const totalAbsenceHours = absences.reduce((sum, abs) => sum + (Number(abs.duration) || 0), 0);

    // Auto-calculate days when absences or schedule change
    useEffect(() => {
        if (!isReadOnly && !convention.attestation_total_jours) {
            // Use the precise calculation based on schedule and dates
            const days = calculateEffectiveInternshipDays(
                convention.stage_date_debut,
                convention.stage_date_fin,
                convention.stage_horaires,
                absences
            );
            setDocData(prev => ({ ...prev, totalJours: days }));
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
                            <div className="text-center font-bold text-lg border-b-2 border-black pb-4 mb-6">
                                ANNEXE 3 : ATTESTATION DE STAGE TYPE
                            </div>

                            <p className="italic text-gray-600 mb-4">
                                Conformément à l’article D. 124-9 du code de l’éducation, une attestation de stage est délivrée par l’organisme d’accueil à tout élève.<br />
                                Ce document doit être complété et signé le dernier jour du stage par un responsable autorisé de l’entreprise d’accueil.<br />
                                Elle est remise au lycéen stagiaire, et également remise à l’établissement scolaire.
                            </p>

                            {/* Body */}
                            <div className="space-y-4">
                                {/* Company Info */}
                                <div className="bg-gray-50 p-4 border border-gray-200 rounded">
                                    <p><strong>L’entreprise (ou l’organisme d’accueil) :</strong></p>
                                    <div className="grid grid-cols-2 gap-4 mt-2">
                                        <div>Nom : <strong>{convention.ent_nom}</strong></div>
                                        <div>Adresse : {convention.ent_adresse}</div>
                                        <div>N° d’immatriculation : {convention.ent_siret}</div>
                                    </div>
                                    <div className="mt-2 text-blue-800">
                                        Représenté(e) par : <strong>{convention.ent_rep_nom}</strong> <span className="mx-2">|</span> Fonction : {convention.ent_rep_fonction}
                                    </div>
                                </div>

                                {/* Student Info */}
                                <div className="mt-6">
                                    <p className="font-bold mb-2">Atteste que l’élève désigné ci-dessous :</p>
                                    <div className="grid grid-cols-2 gap-4 ml-4">
                                        <div>Prénom : <strong>{convention.eleve_prenom}</strong></div>
                                        <div>Nom : <strong>{convention.eleve_nom}</strong></div>
                                        <div>Classe : {convention.eleve_classe}</div>
                                        <div>Date de naissance : {new Date(convention.eleve_date_naissance).toLocaleDateString()}</div>
                                    </div>
                                </div>

                                {/* School Info */}
                                <div className="mt-4 ml-4">
                                    <p className="underline mb-1">Scolarisé dans l’établissement ci-après :</p>
                                    <div>Nom : {convention.ecole_nom}</div>
                                    <div>Adresse : {convention.ecole_adresse}</div>
                                    <div>Représenté par : <strong>{convention.ecole_chef_nom}</strong> en qualité de chef d’établissement</div>
                                </div>

                                {/* Internship Details */}
                                <div className="mt-6 bg-blue-50 p-4 border border-blue-100 rounded">
                                    <p>
                                        a effectué un stage dans notre entreprise ou organisme <br />
                                        du <strong>{new Date(convention.stage_date_debut).toLocaleDateString()}</strong> au <strong>{new Date(convention.stage_date_fin || '').toLocaleDateString()}</strong>
                                    </p>
                                    <div className="mt-4 flex items-center gap-2">
                                        <span>Soit une durée effective totale de :</span>
                                        <input
                                            type="number"
                                            disabled={isReadOnly}
                                            className="w-20 p-1 border rounded font-bold text-center disabled:bg-gray-100"
                                            value={docData.totalJours}
                                            onChange={e => setDocData({ ...docData, totalJours: Number(e.target.value) })}
                                        />
                                        <span>jours</span>
                                        <span className="text-xs text-gray-500 ml-2">(Calculé d'après planning et absences)</span>
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
        </div> // Final closing tag fixed (was missing closing div in previous snippet? No, it was there.)
    ); // Return close
} // Component close
