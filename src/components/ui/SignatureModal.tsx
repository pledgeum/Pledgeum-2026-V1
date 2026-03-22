import { useRef, useEffect, useState } from 'react';
import { X, PenTool, Mail, CheckCircle, Loader2, AlertTriangle } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';

import { useDemoStore } from '@/store/demo';
import { useConventionStore } from '@/store/convention';
import { useSchoolStore } from '@/store/school';
import { parseISO, format } from 'date-fns';

interface SignatureModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSign: (method: 'canvas' | 'otp', signatureImage?: string, extraAuditLog?: any, dualSign?: boolean, newCompanyHeadEmail?: string) => Promise<any> | void;

    title?: string;
    signeeName: string;
    signeeEmail: string;
    conventionId: string;
    role: string;
    hideOtp?: boolean;
    canSignDual?: boolean;
    dualRoleLabel?: string;
    documentType?: 'convention' | 'mission_order' | 'attestation';
}

export function SignatureModal({
    isOpen,
    onClose,
    onSign,
    title = "Signer la convention",
    signeeName,
    signeeEmail,
    conventionId,
    role,
    hideOtp = false,
    canSignDual = false,
    dualRoleLabel = "Signer pour les deux rôles",
    documentType = 'convention'
}: SignatureModalProps) {
    const [activeTab, setActiveTab] = useState<'canvas' | 'otp'>('canvas');
    const [otpCode, setOtpCode] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isDualSignChecked, setIsDualSignChecked] = useState(false);
    const [justification, setJustification] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);
    const [view, setView] = useState<'sign' | 'reject'>('sign');
    const [rejectionReason, setRejectionReason] = useState('');
    const [emailErrorDetails, setEmailErrorDetails] = useState<string | null>(null);
    const [newCompanyHeadEmail, setNewCompanyHeadEmail] = useState('');
    const [emailValidationError, setEmailValidationError] = useState<string | null>(null);


    const sigCanvas = useRef<any>({});
    const { isDemoMode, openEmailModal } = useDemoStore();
    const { conventions, updateConvention, rejectConvention } = useConventionStore();
    const { classes } = useSchoolStore();

    // Derogation / Date Check Logic
    const convention = conventions.find(c => c.id === conventionId);
    const studentClass = convention ? classes.find(c => c.name === convention.eleve_classe || c.id === convention.eleve_classe) : null;

    // Check if dates match any official period
    const isDerogation = convention?.is_out_of_period ?? (() => {
        if (!convention || !studentClass || !studentClass.pfmpPeriods || studentClass.pfmpPeriods.length === 0) return false;

        // Return TRUE if NO period matches the convention dates exactly
        // (Strict check: must match start AND end of one period)
        const match = studentClass.pfmpPeriods.some(p =>
            p.startDate === convention.stage_date_debut && p.endDate === convention.stage_date_fin
        );
        return !match;
    })();

    // Initialize justification from convention if already present
    useEffect(() => {
        if (convention?.derogationJustification) {
            setJustification(convention.derogationJustification);
        }
    }, [convention]);

    useEffect(() => {
        if (isOpen) {
            setLoading(false);
            setOtpCode('');
            setOtpSent(false);
            setActiveTab('canvas');
            setRejectionReason('');
            setNewCompanyHeadEmail('');
            setEmailValidationError(null);

            // Logic for pre-checking dual signature if tutor is also company head
            const isTutorHead = convention?.metadata?.is_tutor_company_head === true;
            if (role === 'tutor' && isTutorHead) {
                setIsDualSignChecked(true);
            } else {
                setIsDualSignChecked(false);
            }
        }
    }, [isOpen, convention, role]);


    if (!isOpen) return null;

    // SUCCESS VIEW
    if (isSuccess) {
        const isRejected = view === 'reject';
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col items-center p-8 text-center space-y-6 animate-in fade-in zoom-in-95">
                    <div className={isRejected ? "bg-red-50 p-5 rounded-full" : "bg-green-50 p-5 rounded-full"}>
                        {isRejected ? (
                            <X className="w-14 h-14 text-red-500" />
                        ) : (
                            <CheckCircle className="w-14 h-14 text-green-500" />
                        )}
                    </div>
                    
                    <div className="space-y-2">
                        <h3 className="text-2xl font-bold text-slate-900 leading-tight">
                            {isRejected ? "Convention refusée" : "Convention signée ! ✅"}
                        </h3>
                        <p className="text-slate-600 font-medium">
                            {isRejected 
                                ? "Le refus a bien été enregistré. Les signataires ont été notifiés." 
                                : "Un e-mail de confirmation a été envoyé aux parties suivantes :"
                            }
                        </p>
                    </div>

                    {!isRejected && (
                        <div className="w-full space-y-3">
                            {(conventions.find(c => c.id === conventionId)?.metadata?.lastRecipients || []).map((item: any, idx: number) => (
                                <div key={idx} className="flex flex-col items-start gap-1">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider ml-1">
                                        {item.role || "Destinataire"}
                                    </span>
                                    <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl group transition-colors hover:bg-slate-100 w-full">
                                        <div className="p-1.5 bg-white rounded-lg shadow-sm border border-slate-200">
                                            <Mail className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                                        </div>
                                        <span className="text-sm font-medium text-slate-700 truncate font-mono tracking-tight">
                                            {(item.email || item).toLowerCase()}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {/* Fallback if list is empty */}
                            {(!conventions.find(c => c.id === conventionId)?.metadata?.lastRecipients?.length) && (
                                <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl w-full">
                                    <div className="p-1.5 bg-white rounded-lg shadow-sm">
                                        <Mail className="w-4 h-4 text-slate-400" />
                                    </div>
                                    <span className="text-sm font-medium text-slate-700 truncate font-mono">
                                        {signeeEmail.toLowerCase()}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {!isRejected && emailErrorDetails && (
                        <div className="bg-amber-50 px-4 py-3 rounded-xl border border-amber-200 text-left w-full flex gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <h4 className="text-sm font-bold text-amber-900">Information d'envoi</h4>
                                <p className="text-xs text-amber-800 leading-relaxed">
                                    Certaines notifications peuvent être retardées : {emailErrorDetails}
                                </p>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={onClose}
                        className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-[0.98] mt-4"
                    >
                        OK, c'est noté
                    </button>
                </div>
            </div>
        );
    }

    const handleClear = () => {
        sigCanvas.current.clear();
    };

    const handleSignatureSave = async (signature: string, newEmail?: string) => {
        // Save justification if needed/present (BEFORE signing)
        if (justification && convention && justification !== convention.derogationJustification) {
            await updateConvention(conventionId, { derogationJustification: justification });
        }

        // We pass the isDualSignChecked state and the new email if delegation occurs
        return await onSign('canvas', signature, undefined, isDualSignChecked, newEmail);
    };


    const validateEmail = (email: string) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    };

    const handleCanvasSubmit = async () => {

        if (sigCanvas.current.isEmpty()) {
            alert("Veuillez signer avant de valider.");
            return;
        }
        if (isDerogation && !justification.trim() && !convention?.derogationJustification) {
            alert("Une justification est requise pour valider ces dates hors période officielle.");
            return;
        }

        // Business Logic: If Tutor delegates legal representative role, email is mandatory
        if (role === 'tutor' && convention?.metadata?.is_tutor_company_head === true && !isDualSignChecked) {
            if (!newCompanyHeadEmail) {
                setEmailValidationError("L'e-mail du représentant légal est obligatoire en cas de délégation.");
                return;
            }
            if (!validateEmail(newCompanyHeadEmail)) {
                setEmailValidationError("L'e-mail saisi n'est pas valide.");
                return;
            }
        }

        setLoading(true);
        setEmailValidationError(null);
        try {
            const dataUrl = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
            const result = await handleSignatureSave(dataUrl, newCompanyHeadEmail);
            console.log('[MODAL] Transitioning to Success Step', result); // [DEBUG]


            // Check for Warnings (Email Failures) from API
            if (result && result.warning === 'EMAIL_FAILED') {
                setEmailErrorDetails(result.debugError || "Erreur d'envoi d'email");
            } else {
                setEmailErrorDetails(null);
            }

            setIsSuccess(true); // Switch to success view
        } catch (e: any) {
            console.error(e);
            alert(e.message || "Erreur lors de la signature");
        } finally {
            setLoading(false);
        }
    };

    const handleRejectSubmit = async () => {
        if (!rejectionReason.trim()) {
            alert("Veuillez indiquer le motif du refus.");
            return;
        }
        setLoading(true);
        try {
            await rejectConvention(conventionId, role, rejectionReason);
            setIsSuccess(true);
        } catch (e: any) {
            alert(e.message || "Erreur lors du refus");
        } finally {
            setLoading(false);
        }
    };

    const handleSendOtp = async () => {
        setLoading(true);

        if (isDemoMode) {
            // Fake Send - Open Interceptor Modal
            setTimeout(() => {
                setLoading(false);
                setOtpSent(true);
                // Open the "Email Simulator" modal to show the user the code
                openEmailModal({
                    to: signeeEmail,
                    subject: `[DEMO] Code de vérification : 1234`,
                    text: `Bonjour,\n\nVotre code de vérification pour la signature est : 1234\n\n(Ceci est une simulation).\n\nCordialement,\nL'équipe Pledgeum`
                });
            }, 800);
            return;
        }

        try {
            const apiPath = documentType === 'mission_order'
                ? `/api/mission-orders/${conventionId}/send-otp`
                : documentType === 'attestation'
                    ? `/api/conventions/${conventionId}/attestation/send-otp`
                    : '/api/otp/send';

            const res = await fetch(apiPath, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email: signeeEmail, conventionId })
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Erreur lors de l'envoi");
            }
            setOtpSent(true);
        } catch (error: any) {
            alert(error.message || "Impossible d'envoyer le code. Vérifiez votre connexion.");
        } finally {
            setLoading(false);
        }
    };

    const handleOtpOnSign = async (dataUrl: string, auditLog: any, newEmail?: string) => {
        // Save justification if needed (OTP flow)
        if (justification && convention && justification !== convention.derogationJustification) {
            await updateConvention(conventionId, { derogationJustification: justification });
        }
        return await onSign('otp', dataUrl, auditLog, isDualSignChecked, newEmail);
    };


    const handleOtpSubmit = async () => {
        if (otpCode.length < 4) {
            alert("Code invalide");
            return;
        }
        if (isDerogation && !justification.trim() && !convention?.derogationJustification) {
            alert("Une justification est requise pour valider ces dates hors période officielle.");
            return;
        }
        // Business Logic: If Tutor delegates legal representative role, email is mandatory
        if (role === 'tutor' && convention?.metadata?.is_tutor_company_head === true && !isDualSignChecked) {
            if (!newCompanyHeadEmail) {
                setEmailValidationError("L'e-mail du représentant légal est obligatoire en cas de délégation.");
                return;
            }
            if (!validateEmail(newCompanyHeadEmail)) {
                setEmailValidationError("L'e-mail saisi n'est pas valide.");
                return;
            }
        }

        setLoading(true);
        setEmailValidationError(null);

        if (isDemoMode) {
            // Fake Verification
            setTimeout(async () => {
                if (otpCode === '1234') {
                    // Success
                    const canvas = document.createElement('canvas');
                    canvas.width = 400;
                    canvas.height = 150;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.fillStyle = '#fff7ed'; // Orange-ish background for demo
                        ctx.fillRect(0, 0, 400, 150);
                        ctx.strokeStyle = '#ea580c';
                        ctx.lineWidth = 2;
                        ctx.strokeRect(5, 5, 390, 140);

                        ctx.font = 'bold 20px Arial';
                        ctx.fillStyle = '#c2410c';
                        ctx.fillText('Signature Numérique DÉMO', 30, 40);

                        ctx.font = '16px Arial';
                        ctx.fillStyle = '#334155';
                        ctx.fillText(`Signé par OTP (Simulé) : ${signeeName}`, 30, 80);
                        ctx.fillText(`Date : ${new Date().toLocaleDateString()}`, 30, 110);
                    }
                    const dataUrl = canvas.toDataURL('image/png');

                    // Fake Audit Log
                    const fakeAuditLog = {
                        timestamp: new Date().toISOString(),
                        verified: true,
                        method: 'otp_demo',
                        email: signeeEmail
                    };

                    await handleOtpOnSign(dataUrl, fakeAuditLog, newCompanyHeadEmail);

                    setIsSuccess(true); // Switch to success view
                } else {
                    alert("Code incorrect (Le code de démo est 1234)");
                }
                setLoading(false);
            }, 800);
            return;
        }

        try {
            const apiPath = documentType === 'mission_order'
                ? `/api/mission-orders/${conventionId}/verify-otp`
                : documentType === 'attestation'
                    ? `/api/conventions/${conventionId}/attestation/verify-otp`
                    : '/api/otp/verify';

            const res = await fetch(apiPath, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: signeeEmail, code: otpCode, conventionId })
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Code invalide");
            }

            // Step 4: Finalize Signature with Audit Log
            // THEME: We use a constant string "OTP_VALIDATED" to signal the PDF generator 
            // that it should render a native digital stamp instead of a raw image.
            const { auditLog } = await res.json();
            const otpDataUrl = "OTP_VALIDATED";
            const result = await handleOtpOnSign(otpDataUrl, auditLog, newCompanyHeadEmail);
            console.log('[MODAL_OTP] Transitioning to Success Step', result); // [DEBUG]

            // Check for Warnings (Email Failures) from API
            if (result && result.warning === 'EMAIL_FAILED') {
                setEmailErrorDetails(result.debugError || "Erreur d'envoi d'email");
            } else {
                setEmailErrorDetails(null);
            }

            setIsSuccess(true); // Switch to success view
        } catch (error: any) {
            alert(error.message || "Erreur de vérification.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4">
            <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-lg overflow-hidden flex flex-col h-[85vh] sm:h-auto sm:max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
                        <p className="text-xs text-gray-500">Signataire : {signeeName}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Warning Banner for Derogation */}
                {isDerogation && (
                    <div className="bg-red-50 border-b border-red-100 p-4">
                        <div className="flex items-start space-x-3">
                            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                                <h4 className="text-sm font-bold text-red-800">Attention : Dates hors calendrier officiel</h4>
                                <p className="text-xs text-red-700 mt-1">
                                    Les dates de cette convention ({convention?.stage_date_debut ? format(parseISO(convention.stage_date_debut), 'dd/MM/yyyy') : '?'} - {convention?.stage_date_fin ? format(parseISO(convention.stage_date_fin), 'dd/MM/yyyy') : '?'})
                                    ne correspondent pas aux périodes définies pour la classe {studentClass?.name}.
                                </p>
                                <div className="mt-3">
                                    <label className="block text-xs font-medium text-red-900 mb-1">
                                        Justification requise pour signer :
                                    </label>
                                    <textarea
                                        value={justification}
                                        onChange={(e) => setJustification(e.target.value)}
                                        placeholder="Ex: Accord exceptionnel du Chef d'Établissement pour décalage d'une semaine..."
                                        className="w-full text-sm border-red-300 rounded-md focus:ring-red-500 focus:border-red-500 min-h-[60px]"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex border-b border-gray-200">
                    <button
                        onClick={() => { setView('sign'); setActiveTab('canvas'); }}
                        className={`flex-1 py-3 text-sm font-medium flex items-center justify-center space-x-2 transition-colors ${view === 'sign' && activeTab === 'canvas' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'
                            }`}
                    >
                        <PenTool className="w-4 h-4" />
                        <span>Dessiner</span>
                    </button>
                    {!hideOtp && (
                        <button
                            onClick={() => { setView('sign'); setActiveTab('otp'); }}
                            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center space-x-2 transition-colors ${view === 'sign' && activeTab === 'otp' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'
                                }`}
                        >
                            <Mail className="w-4 h-4" />
                            <span>Code OTP</span>
                        </button>
                    )}
                    <button
                        onClick={() => setView('reject')}
                        className={`flex-1 py-3 text-sm font-medium flex items-center justify-center space-x-2 transition-colors ${view === 'reject' ? 'text-red-600 border-b-2 border-red-600 bg-red-50/50' : 'text-gray-500 hover:bg-gray-50'
                            }`}
                    >
                        <AlertTriangle className="w-4 h-4" />
                        <span>Refuser</span>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 overflow-y-auto">
                    {view === 'reject' ? (
                        <div className="space-y-6">
                            <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex items-start space-x-3">
                                <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="text-base font-bold text-red-900">Refus de la convention</h4>
                                    <p className="text-sm text-red-700 mt-1">
                                        En refusant cette convention, elle sera définitivement annulée. 
                                        L'élève et les responsables seront notifiés par email.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-gray-700">Motif du refus (obligatoire)</label>
                                <textarea
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    placeholder="Ex: Erreur dans les dates de stage, mission non conforme, etc."
                                    className="w-full h-32 border-gray-300 rounded-xl focus:ring-red-500 focus:border-red-500 text-sm"
                                    required
                                />
                                <p className="text-xs text-gray-400">Ce motif sera transmis aux autres signataires pour correction.</p>
                            </div>

                            <div className="flex space-x-3 pt-2">
                                <button
                                    onClick={() => setView('sign')}
                                    className="flex-1 py-3 border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={handleRejectSubmit}
                                    disabled={loading || !rejectionReason.trim()}
                                    className="flex-[2] py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-bold rounded-xl shadow-md transition-colors flex items-center justify-center space-x-2"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <X className="w-5 h-5" />}
                                    <span>{loading ? 'Traitement...' : 'Confirmer le refus'}</span>
                                </button>
                            </div>
                        </div>
                    ) : activeTab === 'canvas' ? (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-600">Tracez votre signature dans le cadre ci-dessous :</p>
                            <div className="border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 touch-none">
                                <SignatureCanvas
                                    penColor="black"
                                    canvasProps={{ className: 'w-full h-64 rounded-lg' }}
                                    ref={sigCanvas}
                                />
                            </div>
                            <div className="flex justify-between items-center text-xs text-gray-400">
                                <span>Certifié conforme</span>
                                <button onClick={handleClear} className="text-red-500 hover:underline">Effacer</button>
                            </div>

                            {/* Dual Sign Checkbox for Canvas */}
                            {canSignDual && (
                                <div className="space-y-3">
                                    <div className="flex items-start space-x-2 bg-blue-50 p-3 rounded-lg border border-blue-100">
                                        <input
                                            type="checkbox"
                                            id="dualSignCanvas"
                                            checked={isDualSignChecked}
                                            onChange={(e) => setIsDualSignChecked(e.target.checked)}
                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-0.5"
                                        />
                                        <label htmlFor="dualSignCanvas" className="text-sm font-medium text-blue-900 cursor-pointer select-none text-justify">
                                            {dualRoleLabel}
                                        </label>
                                    </div>

                                    {/* Delegation Email Field */}
                                    {role === 'tutor' && convention?.metadata?.is_tutor_company_head === true && !isDualSignChecked && (
                                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300 ml-1 border-l-2 border-blue-200 pl-3 py-1">
                                            <label className="text-xs font-bold text-gray-700 flex items-center">
                                                <Mail className="w-3 h-3 mr-2 text-blue-500" />
                                                E-MAIL DU REPRÉSENTANT LÉGAL
                                            </label>
                                            <input
                                                type="email"
                                                placeholder="exemple@entreprise.fr"
                                                value={newCompanyHeadEmail}
                                                onChange={(e) => {
                                                    setNewCompanyHeadEmail(e.target.value);
                                                    setEmailValidationError(null);
                                                }}
                                                className={`w-full p-2 text-sm border-2 rounded-lg focus:ring-2 outline-none transition-all ${emailValidationError ? 'border-red-300 bg-red-50 focus:ring-red-200' : 'border-gray-200 focus:ring-blue-100 focus:border-blue-400'}`}
                                            />
                                            {emailValidationError ? (
                                                <p className="text-[10px] text-red-600 font-medium flex items-center">
                                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                                    {emailValidationError}
                                                </p>
                                            ) : (
                                                <p className="text-[10px] text-gray-500 italic">
                                                    Une invitation sera envoyée à cette adresse.
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}


                            <button
                                onClick={handleCanvasSubmit}
                                disabled={loading}
                                className="w-full mt-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-lg shadow-sm transition-colors flex items-center justify-center space-x-2"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenTool className="w-4 h-4" />}
                                <span>{loading ? 'Validation en cours...' : 'Signer et Valider'}</span>
                            </button>
                            
                            {/* NEW: Secondary Reject Button */}
                            <button
                                onClick={() => setView('reject')}
                                className="w-full py-2 text-sm text-red-500 hover:text-red-700 font-medium transition-colors"
                            >
                                Refuser cette convention
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {!otpSent ? (
                                <div className="text-center space-y-6 py-8">
                                    <div className="bg-blue-100 p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
                                        <Mail className="w-8 h-8 text-blue-600" />
                                    </div>
                                    <div>
                                        <h4 className="text-base font-medium text-gray-900">Vérification d'identité</h4>
                                        <p className="text-sm text-gray-500 mt-2">
                                            Nous allons envoyer un code de sécurité à 4 chiffres sur : <br />
                                            <span className="font-semibold text-gray-900">{signeeEmail}</span>
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleSendOtp}
                                        disabled={loading}
                                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-lg shadow-sm transition-colors flex justify-center"
                                    >
                                        {loading ? <Loader2 className="animate-spin" /> : "Envoyer le code"}
                                    </button>

                                    {/* NEW: Secondary Reject Button in OTP initial */}
                                    <button
                                        onClick={() => setView('reject')}
                                        className="w-full py-2 text-sm text-red-500 hover:text-red-700 font-medium transition-colors"
                                    >
                                        Refuser cette convention
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                                    <div className="flex items-center space-x-2 text-green-600 bg-green-50 p-3 rounded-lg text-sm">
                                        <CheckCircle className="w-4 h-4" />
                                        <span>Code envoyé ! Vérifiez vos emails.</span>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-700">Code de sécurité</label>
                                        <input
                                            type="text"
                                            value={otpCode}
                                            onChange={(e) => setOtpCode(e.target.value)}
                                            placeholder="Ex: 1234"
                                            className="block w-full text-center text-2xl tracking-widest border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 py-3"
                                            maxLength={4}
                                        />
                                    </div>

                                    {/* Dual Sign Checkbox for OTP */}
                                    {canSignDual && (
                                        <div className="space-y-3">
                                            <div className="flex items-start space-x-2 bg-blue-50 p-3 rounded-lg border border-blue-100">
                                                <input
                                                    type="checkbox"
                                                    id="dualSignOtp"
                                                    checked={isDualSignChecked}
                                                    onChange={(e) => setIsDualSignChecked(e.target.checked)}
                                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-0.5"
                                                />
                                                <label htmlFor="dualSignOtp" className="text-sm font-medium text-blue-900 cursor-pointer select-none text-justify">
                                                    {dualRoleLabel}
                                                </label>
                                            </div>

                                            {/* Delegation Email Field */}
                                            {role === 'tutor' && convention?.metadata?.is_tutor_company_head === true && !isDualSignChecked && (
                                                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300 ml-1 border-l-2 border-blue-200 pl-3 py-1 text-left">
                                                    <label className="text-xs font-bold text-gray-700 flex items-center">
                                                        <Mail className="w-3 h-3 mr-2 text-blue-500" />
                                                        E-MAIL DU REPRÉSENTANT LÉGAL
                                                    </label>
                                                    <input
                                                        type="email"
                                                        placeholder="exemple@entreprise.fr"
                                                        value={newCompanyHeadEmail}
                                                        onChange={(e) => {
                                                            setNewCompanyHeadEmail(e.target.value);
                                                            setEmailValidationError(null);
                                                        }}
                                                        className={`w-full p-2 text-sm border-2 rounded-lg focus:ring-2 outline-none transition-all ${emailValidationError ? 'border-red-300 bg-red-50 focus:ring-red-200' : 'border-gray-200 focus:ring-blue-100 focus:border-blue-400'}`}
                                                    />
                                                    {emailValidationError ? (
                                                        <p className="text-[10px] text-red-600 font-medium flex items-center">
                                                            <AlertTriangle className="w-3 h-3 mr-1" />
                                                            {emailValidationError}
                                                        </p>
                                                    ) : (
                                                        <p className="text-[10px] text-gray-500 italic">
                                                            Une invitation sera envoyée à cette adresse.
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <button
                                        onClick={handleOtpSubmit}
                                        disabled={loading}
                                        className="w-full py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-bold rounded-lg shadow-sm transition-colors flex justify-center"
                                    >
                                        {loading ? <Loader2 className="animate-spin" /> : "Valider le code"}
                                    </button>
                                    <button onClick={() => setOtpSent(false)} className="w-full text-sm text-gray-500 hover:text-gray-900">
                                        Renvoyer le code
                                    </button>

                                    {/* NEW: Secondary Reject Button in OTP verification */}
                                    <button
                                        onClick={() => setView('reject')}
                                        className="w-full py-2 text-sm text-red-500 hover:text-red-700 font-medium transition-colors"
                                    >
                                        Refuser cette convention
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
