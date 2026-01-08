import { useState, useRef, useEffect } from 'react';
import { X, PenTool, Mail, CheckCircle, Loader2 } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { auth } from '@/lib/firebase';

interface SignatureModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSign: (method: 'canvas' | 'otp', signatureImage?: string, extraAuditLog?: any, dualSign?: boolean) => Promise<void> | void;
    title?: string;
    signeeName: string;
    signeeEmail: string;
    conventionId: string;
    hideOtp?: boolean;
    canSignDual?: boolean;
    dualRoleLabel?: string;
}

export function SignatureModal({
    isOpen,
    onClose,
    onSign,
    title = "Signer la convention",
    signeeName,
    signeeEmail,
    conventionId,
    hideOtp = false,
    canSignDual = false,
    dualRoleLabel = "Signer pour les deux rôles"
}: SignatureModalProps) {
    const [activeTab, setActiveTab] = useState<'canvas' | 'otp'>('canvas');
    const [otpCode, setOtpCode] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isDualSignChecked, setIsDualSignChecked] = useState(false);
    const sigCanvas = useRef<any>({});

    useEffect(() => {
        if (isOpen) {
            setLoading(false);
            setOtpCode('');
            setOtpSent(false);
            setActiveTab('canvas');
            setIsDualSignChecked(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleClear = () => {
        sigCanvas.current.clear();
    };

    const handleSignatureSave = async (signature: string) => {
        // We pass the isDualSignChecked state to the onSign callback
        await onSign('canvas', signature, undefined, isDualSignChecked);
    };

    const handleCanvasSubmit = async () => {
        if (sigCanvas.current.isEmpty()) {
            alert("Veuillez signer avant de valider.");
            return;
        }
        setLoading(true);
        try {
            const dataUrl = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
            await handleSignatureSave(dataUrl);
        } catch (e: any) {
            console.error(e);
            alert(e.message || "Erreur lors de la signature");
        } finally {
            setLoading(false);
        }
    };

    const handleSendOtp = async () => {
        setLoading(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch('/api/otp/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token || ''}`
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

    const handleOtpOnSign = async (dataUrl: string, auditLog: any) => {
        await onSign('otp', dataUrl, auditLog, isDualSignChecked);
    };

    const handleOtpSubmit = async () => {
        if (otpCode.length < 4) {
            alert("Code invalide");
            return;
        }
        setLoading(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch('/api/otp/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token || ''}`
                },
                body: JSON.stringify({ email: signeeEmail, code: otpCode })
            });

            if (res.ok) {
                // Generate a "Digital Signature" image
                const canvas = document.createElement('canvas');
                canvas.width = 400;
                canvas.height = 150;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.fillStyle = '#f0f9ff';
                    ctx.fillRect(0, 0, 400, 150);
                    ctx.strokeStyle = '#0284c7';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(5, 5, 390, 140);

                    ctx.font = 'bold 20px Arial';
                    ctx.fillStyle = '#0369a1';
                    ctx.fillText('Signature Numérique Certifiée', 30, 40);

                    ctx.font = '16px Arial';
                    ctx.fillStyle = '#334155';
                    ctx.fillText(`Signé par OTP : ${signeeName}`, 30, 80);
                    ctx.fillText(`Date : ${new Date().toLocaleDateString()}`, 30, 110);

                    ctx.font = 'italic 12px Arial';
                    ctx.fillStyle = '#64748b';
                    ctx.fillText('Authentifié par Convention PFMP', 30, 135);
                }
                const dataUrl = canvas.toDataURL('image/png');

                // Pass the audit log from the API response
                const { auditLog } = await res.json();
                await handleOtpOnSign(dataUrl, auditLog);
            } else {
                alert("Code incorrect ou expiré.");
            }
        } catch (error) {
            alert("Erreur de vérification.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
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

                {/* Tabs */}
                <div className="flex border-b border-gray-200">
                    <button
                        onClick={() => setActiveTab('canvas')}
                        className={`flex-1 py-3 text-sm font-medium flex items-center justify-center space-x-2 transition-colors ${activeTab === 'canvas' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'
                            }`}
                    >
                        <PenTool className="w-4 h-4" />
                        <span>Dessiner</span>
                    </button>
                    {!hideOtp && (
                        <button
                            onClick={() => setActiveTab('otp')}
                            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center space-x-2 transition-colors ${activeTab === 'otp' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'
                                }`}
                        >
                            <Mail className="w-4 h-4" />
                            <span>Code OTP</span>
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="p-6 flex-1 overflow-y-auto">
                    {activeTab === 'canvas' ? (
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
                            )}

                            <button
                                onClick={handleCanvasSubmit}
                                disabled={loading}
                                className="w-full mt-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-lg shadow-sm transition-colors flex items-center justify-center space-x-2"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenTool className="w-4 h-4" />}
                                <span>{loading ? 'Validation en cours...' : 'Signer et Valider'}</span>
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
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
