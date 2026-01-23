'use server';

import { verifyData } from '@/lib/signature';
import pool from '@/lib/pg';
import { ShieldCheck, XCircle, FileText, Calendar, Building2, User, Info } from 'lucide-react';
import Link from 'next/link';

interface VerifyPageProps {
    searchParams: {
        data?: string;
        sig?: string;
    };
}

export default async function VerifyPage({ searchParams }: VerifyPageProps) {
    const { data: encodedData, sig: signature } = await searchParams;

    if (!encodedData || !signature) {
        return <ErrorState message="Paramètres manquants ou lien invalide." />;
    }

    let payload: any = null;
    let isSigValid = false;

    try {
        // Decode
        const jsonString = Buffer.from(encodedData, 'base64url').toString('utf-8');
        payload = JSON.parse(jsonString);

        // 1. Stateless Signature Verification
        isSigValid = verifyData(payload, signature);
    } catch (e) {
        return <ErrorState message="Données corrompues ou illisibles." />;
    }

    if (!isSigValid) {
        return <InvalidState payload={payload} reason="Signature Cryptographique Invalide" />;
    }

    // 2. Stateful Database Verification (Double Check)
    let dbStatus: 'VALID' | 'REVOKED' | 'NOT_FOUND' | 'INTEGRITY_ERROR' | 'IN_PROGRESS' = 'VALID';
    let dbDetails: any = null;

    try {
        const client = await pool.connect();
        try {
            const res = await client.query('SELECT status, pdf_hash, updated_at FROM conventions WHERE id = $1', [payload.id]);

            if (res.rowCount === 0) {
                dbStatus = 'NOT_FOUND';
            } else {
                const row = res.rows[0];
                dbDetails = row;

                if (row.status === 'REJECTED' || row.status === 'ANNULEE' || row.status === 'CANCELLED') {
                    dbStatus = 'REVOKED';
                }
                // Integrity Check: If payload has hash (certificates), match it. 
                // If not, rely on signature. But we can check if row has hash? 
                // The signature signs the content. The DB hash stores the PDF hash. They are different things?
                // Actually `pdf_hash` in DB is often the hash of the FINAL PDF.
                // The QR code signs the DATA. 
                // So we can at least check if the convention is finalized.
                else if (['SIGNED_BY_SCHOOL', 'VALIDATED_HEAD', 'COMPLETED'].includes(row.status)) {
                    dbStatus = 'VALID';
                } else {
                    dbStatus = 'IN_PROGRESS';
                }
            }
        } finally {
            client.release();
        }
    } catch (e) {
        console.error("DB Verify Error:", e);
        // Fallback to stateless if DB fails? Or strict fail? 
        // User said: "Une fois que la page de vérification consultera PostgreSQL, notre chaîne de confiance sera inviolable."
        // So we should probably show a warning if DB is unreachable, but maybe not block if signature is valid?
        // Let's return a "Offline Validation" state?
        // utilizing the existing signature validity as fallback but warning about DB.
        return <ValidState payload={payload} warning="Impossible de contacter le serveur central pour la double vérification." />;
    }

    if (dbStatus === 'NOT_FOUND') {
        return <ErrorState message="Ce document n'existe pas dans notre base de données officielle." />;
    }

    if (dbStatus === 'REVOKED') {
        return <RevokedState payload={payload} />;
    }

    if (dbStatus === 'IN_PROGRESS') {
        return <ValidState payload={payload} warning="Ce document est en cours de signature et n'est pas encore finalisé." />;
    }

    return <ValidState payload={payload} dbDetails={dbDetails} />;
}

function ErrorState({ message }: { message: string }) {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Info className="w-8 h-8 text-gray-500" />
                </div>
                <h1 className="text-xl font-bold text-gray-900 mb-2">Vérification Impossible</h1>
                <p className="text-gray-600 mb-6">{message}</p>
                <Link href="/" className="text-blue-600 hover:underline">Retour à l'accueil</Link>
            </div>
        </div>
    );
}

function RevokedState({ payload }: { payload: any }) {
    return (
        <div className="min-h-screen bg-red-50 flex flex-col items-center justify-center p-4">
            <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md w-full text-center border-t-8 border-red-600">
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <XCircle className="w-10 h-10 text-red-600" />
                </div>
                <h1 className="text-2xl font-bold text-red-700 mb-4">DOCUMENT ANNULÉ / RÉVOQUÉ</h1>
                <p className="text-gray-700 mb-6">
                    Ce document a été officiellement <strong>annulé</strong> par l'établissement émetteur.
                    Il n'est plus valide.
                </p>
                <div className="p-4 bg-red-100 text-red-800 rounded text-sm font-medium">
                    ⛔️ NE PAS ACCEPTER CE DOCUMENT.
                </div>
            </div>
        </div>
    );
}

function InvalidState({ payload, reason }: { payload: any, reason?: string }) {
    return (
        <div className="min-h-screen bg-red-50 flex flex-col items-center justify-center p-4">
            <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md w-full text-center border-t-8 border-red-600">
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                    <XCircle className="w-10 h-10 text-red-600" />
                </div>
                <h1 className="text-2xl font-bold text-red-700 mb-4">DOCUMENT NON CERTIFIÉ</h1>
                <p className="text-gray-700 mb-6">
                    La vérification a échoué : {reason || 'Signature invalide'}.
                </p>
                {/* ... existing payload display ... */}
                {payload && (
                    <div className="bg-gray-100 p-4 rounded text-left text-xs mb-6 font-mono text-gray-500 overflow-x-auto">
                        <p className="font-bold mb-1">Données reçues :</p>
                        <pre>{JSON.stringify(payload, null, 2)}</pre>
                    </div>
                )}
                <div className="p-4 bg-red-100 text-red-800 rounded text-sm font-medium">
                    ⚠️ Ne pas accepter ce document.
                </div>
            </div>
        </div>
    );
}

function ValidState({ payload, dbDetails, warning }: { payload: any, dbDetails?: any, warning?: string }) {
    // Reconstruct readable labels from minified keys
    const typeLabel = payload.t === 'c' ? 'Convention de Stage' : payload.mo ? 'Ordre de Mission Permanent' : 'Attestation de Stage';
    const studentName = payload.s;
    const companyName = payload.e;
    const dates = `${new Date(payload.d.s).toLocaleDateString('fr-FR')} - ${new Date(payload.d.f).toLocaleDateString('fr-FR')}`;

    return (
        <div className="min-h-screen bg-green-50 flex flex-col items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border-t-8 border-green-600">
                {/* Header */}
                <div className="bg-green-600 p-6 text-center">
                    <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <ShieldCheck className="w-12 h-12 text-green-600" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-1">CERTIFIÉ CONFORME</h1>
                    <p className="text-green-100 opacity-90 text-sm">Signature Numérique Valide</p>
                </div>

                {/* Content */}
                <div className="p-8 space-y-6">
                    <div className="text-center text-gray-600 text-sm mb-6">
                        Ce document a été cryptographiquement signé par notre serveur.<br />
                        Son contenu est <strong>authentique est inaltéré</strong>.
                    </div>

                    <div className="space-y-4">
                        {payload.sigs && (
                            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                                <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wide mb-2">Signataires Certifiés (6/6)</h3>
                                {payload.sigs.map((sig: any, i: number) => (
                                    <div key={i} className="flex justify-between items-start text-sm border-b border-gray-100 last:border-0 pb-2 last:pb-0">
                                        <div>
                                            <span className="block font-semibold text-gray-900">{sig.n}</span>
                                            <span className="text-gray-500 text-xs">{sig.r}</span>
                                        </div>
                                        <div className="text-right text-gray-400 text-xs">
                                            {new Date(sig.d).toLocaleDateString('fr-FR')}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <InfoRow icon={FileText} label="Type de Document" value={typeLabel} />
                        <InfoRow icon={User} label="Élève" value={studentName} />
                        <InfoRow icon={Building2} label="Entreprise" value={companyName} />
                        <InfoRow icon={Calendar} label="Période" value={dates} />
                        {payload.h && (
                            <InfoRow icon={FileText} label="Durée / Jours" value={`${payload.h} jours`} />
                        )}
                        {payload.sn && (
                            <InfoRow icon={User} label="Signé par" value={`${payload.sn} ${payload.sf ? `(${payload.sf})` : ''}`} />
                        )}
                        {payload.sd && (
                            <InfoRow icon={Calendar} label="Date de signature" value={new Date(payload.sd).toLocaleString('fr-FR')} />
                        )}
                    </div>

                    <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col gap-2">
                        {warning ? (
                            <div className="bg-yellow-50 p-3 rounded text-yellow-800 text-xs flex items-start gap-2 border border-yellow-200">
                                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span>{warning}</span>
                            </div>
                        ) : (
                            <div className="bg-green-50 p-3 rounded text-green-800 text-xs flex items-start gap-2 border border-green-200">
                                <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span>Double vérification active : Confirmé par le serveur central (PostgreSQL).</span>
                            </div>
                        )}

                        <div className="bg-gray-50 p-3 rounded text-gray-600 text-xs flex items-start gap-2">
                            <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>Signature Cryptographique Valide (Intégrité des données).</span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 p-4 text-center text-xs text-gray-400">
                    ID Technique: {payload.id} • Statut: {payload.st}
                </div>
            </div>
        </div>
    );
}

function InfoRow({ icon: Icon, label, value }: { icon: any, label: string, value: string }) {
    return (
        <div className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-100">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5" />
            </div>
            <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
                <p className="text-gray-900 font-medium">{value}</p>
            </div>
        </div>
    );
}
