import React, { useState, useEffect } from 'react';
import { X, QrCode, Camera, AlertTriangle, KeyRound, Search, CheckCircle, FileText } from 'lucide-react';
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
    const [result, setResult] = useState<{ convention: Convention; role: string; type: 'convention' | 'attestation'; signerName: string; date: string } | null>(null);
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

        if (!code.trim()) {
            setManualError("Veuillez entrer un code de signature.");
            return;
        }

        const convention = await verifySignature(code.trim());

        if (convention) {
            let role = '';
            let type: 'convention' | 'attestation' = 'convention';
            let signerName = '';
            let date = '';

            if (convention.attestation_signature_code === code.trim()) {
                role = "Entreprise (Attestation)";
                type = 'attestation';
                signerName = convention.tuteur_nom;
                date = convention.attestationDate || '';
            } else {
                const s = convention.signatures;
                if (s.studentCode === code.trim()) {
                    role = 'Élève';
                    signerName = `${convention.eleve_prenom} ${convention.eleve_nom}`;
                    date = s.studentAt || '';
                }
                else if (s.parentCode === code.trim()) {
                    role = 'Représentant Légal';
                    signerName = convention.rep_legal_nom || '';
                    date = s.parentAt || '';
                }
                else if (s.teacherCode === code.trim()) {
                    role = 'Enseignant Référent/Professeur Principal';
                    signerName = convention.prof_nom;
                    date = s.teacherAt || '';
                }
                else if (s.companyCode === code.trim()) {
                    role = 'Représentant Entreprise';
                    signerName = convention.ent_rep_nom;
                    date = s.companyAt || '';
                }
                else if (s.tutorCode === code.trim()) {
                    role = 'Tuteur';
                    signerName = convention.tuteur_nom;
                    date = s.tutorAt || '';
                }
                else if (s.headCode === code.trim()) {
                    role = 'Chef d\'Établissement';
                    signerName = convention.ecole_chef_nom;
                    date = s.headAt || '';
                }
            }
            setResult({ convention, role, type, signerName, date });
        } else {
            setManualError("Aucune signature trouvée pour ce code.");
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Code de signature numérique (8 lettres + 5 chiffres)
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={code}
                                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                                        placeholder="XXXXXXXX-12345"
                                        className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 uppercase tracking-widest font-mono"
                                    />
                                    <button
                                        onClick={handleManualVerify}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
                                    >
                                        Vérifier
                                    </button>
                                </div>
                            </div>

                            {manualError && (
                                <div className="p-4 bg-red-50 text-red-700 rounded-md flex items-start gap-3">
                                    <AlertTriangle className="w-5 h-5 shrink-0" />
                                    <p className="text-sm font-medium">{manualError}</p>
                                </div>
                            )}

                            {result && (
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
                                                {result.type === 'attestation' ? 'Attestation PFMP' : 'Convention PFMP'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between border-b border-green-200 pb-1">
                                            <span className="text-green-700">Signataire :</span>
                                            <span className="font-bold">{result.role}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-green-200 pb-1">
                                            <span className="text-green-700">Concernant :</span>
                                            <span className="font-medium">{result.convention.eleve_prenom} {result.convention.eleve_nom}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-green-200 pb-1">
                                            <span className="text-green-700">Date :</span>
                                            <span className="font-medium">{result.date ? new Date(result.date).toLocaleDateString('fr-FR') : 'N/A'}</span>
                                        </div>
                                    </div>

                                    {onViewDocument && (
                                        <button
                                            onClick={() => onViewDocument(result!.convention, result!.type)}
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

                <div className="p-4 bg-gray-50 text-xs text-gray-500 text-center">
                    Système de vérification cryptographique instantané.
                </div>
            </div>
        </div>
    );
}
