import React, { useState, useEffect } from 'react';
import { X, QrCode, Camera, AlertTriangle, KeyRound, Search, CheckCircle, FileText, Building2, Calendar, User } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useRouter } from 'next/navigation';
import { useConventionStore, Convention } from '@/store/convention';

interface SignatureVerificationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onViewDocument?: (convention: Convention, type: 'convention' | 'attestation') => void;
}

export function SignatureVerificationModal({ isOpen, onClose, onViewDocument }: SignatureVerificationModalProps) {
    const router = useRouter();
    const [scanError, setScanError] = useState<string>('');
    const [view, setView] = useState<'menu' | 'scan' | 'manual'>('menu');

    // Manual Verification State
    const [code, setCode] = useState('');
    const [manualError, setManualError] = useState('');
    const [result, setResult] = useState<{
        convention: Convention;
        role: string;
        type: 'convention' | 'attestation' | 'mission_order';
        signerName: string;
        date: string;
        isValid?: boolean;
        document?: any;
    } | null>(null);
    const { verifySignature } = useConventionStore();

    useEffect(() => {
        if (isOpen && view === 'scan') {
            const scanner = new Html5QrcodeScanner(
                "reader",
                { fps: 10, qrbox: { width: 250, height: 250 } },
                /* verbose= */ false
            );

            scanner.render(
                (decodedText) => {
                    // Success callback
                    scanner.clear();

                    // Check if it's a valid local URL
                    if (decodedText.includes('/verify?data=')) {
                        // Extract relative path if possible, or force full redirect
                        try {
                            const url = new URL(decodedText);
                            router.push(url.pathname + url.search);
                            onClose();
                        } catch (e) {
                            // If not a valid URL object, maybe it's relative
                            router.push(decodedText);
                            onClose();
                        }
                    } else {
                        setScanError("Ce QR Code ne semble pas provenir de cette application.");
                    }
                },
                (errorMessage) => {
                    // Ignore frame scan errors
                }
            );

            return () => {
                scanner.clear().catch(console.error);
            };
        }
    }, [isOpen, view, router, onClose]);

    const handleManualVerify = async () => {
        setManualError('');
        setResult(null);

        const sanitizedCode = code.trim();

        if (!sanitizedCode) {
            setManualError("Veuillez entrer un code de signature.");
            return;
        }

        try {
            const response = await fetch(`/api/verify?code=${encodeURIComponent(sanitizedCode)}`);
            if (!response.ok) {
                if (response.status === 404) {
                    setManualError("Aucune signature trouvée pour ce code.");
                } else {
                    setManualError("Une erreur est survenue lors de la vérification.");
                }
                return;
            }

            const data = await response.json();
            if (data.success && data.convention) {
                const convention = data.convention;
                const trimmedCode = sanitizedCode;

                let role = '';
                let type: 'convention' | 'attestation' | 'mission_order' = 'convention';
                let signerName = '';
                let date = '';

                if ((convention as any).type === 'mission_order') {
                    const s = convention.signatures as any || {};
                    type = 'mission_order' as any;
                    if (s.teacher?.code?.toUpperCase().startsWith(trimmedCode)) {
                        role = 'Enseignant Suiveur';
                        signerName = convention.prof_nom || 'Enseignant';
                        date = s.teacher?.signedAt || '';
                    } else if (s.head?.code?.toUpperCase().startsWith(trimmedCode)) {
                        role = 'Chef d\'Établissement';
                        signerName = convention.ecole_chef_nom || 'Chef d\'Établissement';
                        date = s.head?.signedAt || '';
                    } else {
                        role = 'Signataire Ordre de Mission';
                        signerName = 'Inconnu';
                        date = convention.createdAt || '';
                    }
                } else if (convention.attestation_signature_code?.toUpperCase().startsWith(trimmedCode)) {
                    role = "Entreprise (Attestation)";
                    type = 'attestation';
                    signerName = convention.tuteur_nom;
                    date = convention.attestationDate || '';
                } else if (convention.certificateHash?.toUpperCase().startsWith(trimmedCode) || convention.attestationHash?.toUpperCase().startsWith(trimmedCode)) {
                    role = "Empreinte Numérique (Hash)";
                    signerName = "Document Certifié Publiquement";
                    date = convention.updatedAt || convention.createdAt || '';
                } else {
                    const s = convention.signatures as any;
                    if ((s.student?.code || s.studentCode)?.toUpperCase().startsWith(trimmedCode)) {
                        role = 'Élève';
                        signerName = `${convention.eleve_prenom} ${convention.eleve_nom}`;
                        date = s.student?.signedAt || s.studentAt || '';
                    }
                    else if ((s.parent?.code || s.parentCode)?.toUpperCase().startsWith(trimmedCode)) {
                        role = 'Représentant Légal';
                        signerName = convention.rep_legal_nom || '';
                        date = s.parent?.signedAt || s.parentAt || '';
                    }
                    else if ((s.teacher?.code || s.teacherCode)?.toUpperCase().startsWith(trimmedCode)) {
                        role = 'Enseignant Référent/Professeur Principal';
                        signerName = convention.prof_nom;
                        date = s.teacher?.signedAt || s.teacherAt || '';
                    }
                    else if ((s.company?.code || s.companyCode)?.toUpperCase().startsWith(trimmedCode)) {
                        role = 'Représentant Entreprise';
                        signerName = convention.ent_rep_nom;
                        date = s.company?.signedAt || s.companyAt || '';
                    }
                    else if ((s.tutor?.code || s.tutorCode)?.toUpperCase().startsWith(trimmedCode)) {
                        role = 'Tuteur';
                        signerName = convention.tuteur_nom;
                        date = s.tutor?.signedAt || s.tutorAt || '';
                    }
                    else if ((s.head?.code || s.headCode)?.toUpperCase().startsWith(trimmedCode)) {
                        role = 'Chef d\'Établissement';
                        signerName = convention.ecole_chef_nom;
                        date = s.head?.signedAt || s.headAt || '';
                    }
                }
                setResult({
                    convention,
                    role,
                    type: type as any,
                    signerName,
                    date,
                    isValid: data.isValid,
                    document: data.document
                });
            } else {
                setManualError("Aucune signature trouvée pour ce code.");
            }
        } catch (e) {
            console.error(e);
            setManualError("Erreur de connexion au service de vérification.");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center p-4 border-b bg-gray-50">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                        <QrCode className="w-5 h-5 text-blue-600" />
                        Authentification des Documents
                    </h3>
                    <button onClick={onClose}><X className="w-5 h-5 text-gray-500 hover:text-gray-700" /></button>
                </div>

                <div className="p-6">
                    {view === 'menu' && (
                        <div className="flex flex-col gap-4">
                            <div className="text-center text-sm text-gray-600 mb-2">
                                Choisissez une méthode de vérification :
                            </div>
                            <button
                                onClick={() => setView('scan')}
                                className="flex items-center justify-center gap-3 p-4 border-2 border-blue-100 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-all group"
                            >
                                <div className="bg-blue-100 p-3 rounded-full group-hover:bg-blue-200 text-blue-600">
                                    <Camera className="w-6 h-6" />
                                </div>
                                <div className="text-left">
                                    <div className="font-bold text-gray-900">Scanner le QR Code</div>
                                    <div className="text-xs text-gray-500">Utilisez votre caméra</div>
                                </div>
                            </button>

                            <button
                                onClick={() => setView('manual')}
                                className="flex items-center justify-center gap-3 p-4 border-2 border-gray-100 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all group"
                            >
                                <div className="bg-gray-100 p-3 rounded-full group-hover:bg-gray-200 text-gray-600">
                                    <KeyRound className="w-6 h-6" />
                                </div>
                                <div className="text-left">
                                    <div className="font-bold text-gray-900">Saisir le code</div>
                                    <div className="text-xs text-gray-500">Code alphanumeric sur la convention</div>
                                </div>
                            </button>
                        </div>
                    )}

                    {view === 'scan' && (
                        <div className="space-y-4">
                            <button onClick={() => setView('menu')} className="text-sm text-blue-600 hover:underline mb-2 flex items-center">
                                ← Retour au choix
                            </button>
                            <div className="text-center text-sm text-gray-600 mb-4">
                                Placez le QR Code du document devant votre caméra pour vérifier son authenticité.
                            </div>

                            <div id="reader" className="overflow-hidden rounded-lg mx-auto bg-gray-100 border border-gray-300 min-h-[300px]"></div>

                            {scanError && (
                                <div className="p-3 bg-red-50 text-red-700 rounded-md flex items-center gap-2 text-sm mt-4">
                                    <AlertTriangle className="w-4 h-4" />
                                    {scanError}
                                </div>
                            )}
                        </div>
                    )}

                    {view === 'manual' && (
                        <div className="space-y-4">
                            <button onClick={() => setView('menu')} className="text-sm text-blue-600 hover:underline mb-2 flex items-center">
                                ← Retour au choix
                            </button>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    Certificat d'Authenticité de la convention ou de la signature
                                </label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1 group">
                                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                        <input
                                            type="text"
                                            value={code}
                                            onChange={(e) => setCode(e.target.value.toUpperCase().trim())}
                                            placeholder="Saisissez le code (ex: VOTRE-CODE-ICI)"
                                            className="w-full pl-10 pr-4 py-3 rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 uppercase tracking-widest font-mono text-sm transition-all"
                                            maxLength={32}
                                        />
                                    </div>
                                    <button
                                        onClick={handleManualVerify}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md active:scale-95 flex items-center gap-2"
                                    >
                                        <Search className="w-4 h-4" />
                                        Vérifier
                                    </button>
                                </div>
                                <p className="mt-2 text-[10px] text-gray-400 font-medium text-center">
                                    Saisissez le numéro de certificat d'authenticité numérique du document situés sous le QR ou bien le numéro de certificat situé dans la case de la signature numérique à vérifier.
                                </p>
                            </div>

                            {manualError && (
                                <div className="p-4 bg-red-50 text-red-700 rounded-md flex items-start gap-3">
                                    <AlertTriangle className="w-5 h-5 shrink-0" />
                                    <p className="text-sm font-medium">{manualError}</p>
                                </div>
                            )}

                            {result && (
                                <div className="space-y-4">
                                    {result.type === 'attestation' ? (
                                        <div className="p-4 bg-green-50 rounded-lg border border-green-200 animate-in fade-in slide-in-from-bottom-2">
                                            <div className="flex items-center gap-2 mb-3">
                                                <CheckCircle className="w-6 h-6 text-green-600" />
                                                <h3 className="text-green-800 font-bold text-lg">✅ Attestation de PFMP Authentifiée</h3>
                                            </div>
                                            <div className="space-y-1.5 text-sm">
                                                <p className="text-gray-700"><strong>Document :</strong> Attestation de fin de PFMP</p>
                                                <p className="text-gray-700"><strong>Élève :</strong> {result.document?.student_first_name} {result.document?.student_last_name}</p>
                                                <p className="text-gray-700"><strong>Entreprise :</strong> {result.document?.company_name}</p>
                                                <p className="text-gray-700"><strong>Ville :</strong> {result.document?.company_city}</p>
                                                <p className="text-gray-700"><strong>Période :</strong> Du {result.document?.dateStart ? new Date(result.document.dateStart).toLocaleDateString('fr-FR') : '?'} au {result.document?.dateEnd ? new Date(result.document.dateEnd).toLocaleDateString('fr-FR') : '?'}</p>
                                                <p className="text-gray-700"><strong>Date de signature :</strong> {result.document?.updatedAt ? new Date(result.document.updatedAt).toLocaleDateString('fr-FR') : 'N/A'}</p>
                                                <p className="text-gray-500 mt-4 text-[10px] font-mono break-all">
                                                    Certificat cryptographique : {code}
                                                </p>
                                            </div>
                                            <div className="mt-4 pt-4 border-t border-green-200">
                                                <a
                                                    href={`/api/conventions/${result.document?.conventionId}/attestation/pdf`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center text-sm font-medium text-green-700 hover:text-green-800"
                                                >
                                                    <FileText className="w-4 h-4 mr-2" />
                                                    Voir le document authentifié
                                                </a>
                                            </div>
                                        </div>
                                    ) : result.type === ('mission_order' as any) ? (
                                        <div className="p-4 bg-green-50 rounded-lg border border-green-200 animate-in fade-in slide-in-from-bottom-2">
                                            <div className="flex items-center gap-2 mb-3">
                                                <CheckCircle className="w-6 h-6 text-green-600" />
                                                <h3 className="text-green-800 font-bold text-lg">✅ Ordre de Mission Authentifié</h3>
                                            </div>
                                            <div className="space-y-1.5 text-sm">
                                                <p className="text-gray-700"><strong>Document :</strong> Ordre de Mission pour suivi PFMP</p>
                                                <p className="text-gray-700"><strong>Enseignant :</strong> {result.document?.teacher_first_name} {result.document?.teacher_last_name}</p>
                                                <p className="text-gray-700"><strong>Élève suivi :</strong> {result.document?.student_first_name} {result.document?.student_last_name}</p>
                                                <p className="text-gray-700"><strong>Entreprise :</strong> {result.document?.company_name}</p>
                                                <p className="text-gray-700"><strong>Ville :</strong> {result.document?.company_city}</p>
                                                <p className="text-gray-700"><strong>Date :</strong> {result.document?.createdAt ? new Date(result.document.createdAt).toLocaleDateString('fr-FR') : 'N/A'}</p>
                                                <p className="text-gray-500 mt-4 text-[10px] font-mono break-all">
                                                    Certificat cryptographique : {code}
                                                </p>
                                            </div>
                                            <div className="mt-4 pt-4 border-t border-green-200">
                                                <a
                                                    href={`/api/mission-orders/${result.document?.id}/pdf`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center text-sm font-medium text-green-700 hover:text-green-800"
                                                >
                                                    <FileText className="w-4 h-4 mr-2" />
                                                    Voir le document authentifié
                                                </a>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-4 bg-green-50 text-green-800 rounded-md border border-green-200 space-y-3">
                                            <div className="flex items-center gap-2 mb-2">
                                                <CheckCircle className="w-6 h-6 text-green-600" />
                                                <span className="font-bold text-lg">Signature Valide</span>
                                            </div>

                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between border-b border-green-200 pb-1">
                                                    <span className="text-green-700">Type de document :</span>
                                                    <span className="font-medium flex items-center gap-1">
                                                        <FileText className="w-4 h-4" />
                                                        Convention PFMP
                                                    </span>
                                                </div>
                                                <div className="flex justify-between border-b border-green-200 pb-1">
                                                    <span className="text-green-700 flex items-center gap-1">
                                                        <Calendar className="w-3 h-3" />
                                                        Période :
                                                    </span>
                                                    <span className="font-medium text-xs">
                                                        {result.convention.dateStart ? new Date(result.convention.dateStart).toLocaleDateString('fr-FR') : '?'}
                                                        {' → '}
                                                        {result.convention.dateEnd ? new Date(result.convention.dateEnd).toLocaleDateString('fr-FR') : '?'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between border-b border-green-200 pb-1">
                                                    <span className="text-green-700">Date de signature (Chef d'établissement) :</span>
                                                    <span className="font-medium">
                                                        {(result.convention.signatures as any)?.head?.signedAt
                                                            ? new Date((result.convention.signatures as any).head.signedAt).toLocaleDateString('fr-FR')
                                                            : 'N/A'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Signatories List */}
                                            {result.convention.signatures && Object.keys(result.convention.signatures).length > 0 && (
                                                <div className="mt-4 pt-3 border-t border-green-200">
                                                    <p className="text-[10px] font-black text-green-700 uppercase tracking-widest mb-2">Autres Signatures Certifiées</p>
                                                    <div className="space-y-2">
                                                        {Object.entries(result.convention.signatures as Record<string, any>)
                                                            .filter(([_, data]) => data?.signedAt)
                                                            .map(([role, data], i) => {
                                                                const roleLabels: Record<string, string> = {
                                                                    student: 'Élève',
                                                                    parent: 'Représentant Légal',
                                                                    teacher: 'Enseignant Référent',
                                                                    company_head: 'Chef d\'Entreprise',
                                                                    company: 'Chef d\'Entreprise',
                                                                    tutor: 'Tuteur en Entreprise',
                                                                    head: 'Chef d\'Établissement'
                                                                };
                                                                const label = roleLabels[role] || role;

                                                                const m = (result.convention as any).metadata || {};
                                                                const c = result.convention as any;
                                                                let signerName = data.name;

                                                                if (!signerName || signerName === role) {
                                                                    if (role === 'student') signerName = c.eleve_nom ? `${c.eleve_prenom || ''} ${c.eleve_nom}`.trim() : (c.lastName ? `${c.firstName || ''} ${c.lastName}`.trim() : (m.eleve_nom ? `${m.eleve_prenom || ''} ${m.eleve_nom}`.trim() : null));
                                                                    else if (role === 'parent') signerName = c.rep_legal_nom || m.rep_legal_nom;
                                                                    else if (role === 'teacher') signerName = c.prof_nom || m.prof_nom;
                                                                    else if (role === 'company_head' || role === 'company') signerName = c.ent_rep_nom || m.ent_rep_nom;
                                                                    else if (role === 'tutor') signerName = c.tuteur_nom || m.tuteur_nom;
                                                                    else if (role === 'head') signerName = c.ecole_chef_nom || m.ecole_chef_nom;
                                                                }

                                                                return (
                                                                    <div key={i} className="flex justify-between items-center text-[10px] bg-white/50 p-1.5 rounded border border-green-100">
                                                                        <div>
                                                                            <span className="font-bold block text-gray-700">{label} : {signerName || role}</span>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <span className="text-green-600 font-bold block">Vérifié</span>
                                                                            <span className="text-gray-300">{new Date(data.signedAt).toLocaleDateString('fr-FR')}</span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })
                                                        }
                                                    </div>
                                                </div>
                                            )}

                                            {onViewDocument && (
                                                <button
                                                    onClick={() => onViewDocument(result!.convention, result!.type as any)}
                                                    className="w-full mt-2 flex items-center justify-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                                                >
                                                    <FileText className="w-4 h-4 mr-2" />
                                                    Voir le document signé
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-4 bg-gray-50 text-xs text-gray-500 text-center">
                    Système de vérification cryptographique instantané.
                </div>
            </div>
        </div>
    );
}
