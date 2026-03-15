'use server';

import { verifyData } from '@/lib/signature';
import pool from '@/lib/pg';
import { ShieldCheck, XCircle, FileText, Calendar, Building2, User, Info, Search, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

interface VerifyPageProps {
    searchParams: {
        data?: string;
        sig?: string;
        code?: string;
    };
}

export default async function VerifyPage({ searchParams }: VerifyPageProps) {
    const { data: encodedData, sig: signature, code: rawManualCode } = await searchParams;
    const manualCode = (rawManualCode || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().trim();

    // SCENARIO 0: Idle state (No params) -> Show Search UI
    if (!encodedData && !signature && !manualCode) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-lg w-full text-center border border-gray-100">
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <ShieldCheck className="w-10 h-10 text-blue-600" />
                    </div>
                    <h1 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">Vérification de Document</h1>
                    <p className="text-gray-500 mb-8">Scannez un QR Code ou saisissez le code d'authentification présent sur votre document ou sous la signature.</p>

                    <SearchForm />

                    <div className="mt-12 flex items-center justify-center gap-2 text-xs text-gray-400">
                        <ShieldCheck className="w-3 h-3" />
                        <span>Propulsé par Pledgeum Trust Protocol</span>
                    </div>
                </div>
            </div>
        );
    }

    // SCENARIO 1: Manual Code Verification (Alphanumeric)
    if (manualCode && !encodedData) {
        try {
            const isOdmPrefix = manualCode.startsWith('ODM');

            const checkMissionOrder = async (searchStr: string) => {
                const moQuery = `
                    SELECT m.id, m.status, m.signature_data, m.created_at,
                           c.id as convention_id, c.metadata, c.date_start, c.date_end, c.type
                    FROM mission_orders m
                    JOIN conventions c ON c.id = m.convention_id
                    WHERE (
                        m.id::text ILIKE $1 
                        OR REPLACE(m.id::text, '-', '') ILIKE $1 
                        OR REPLACE(m.id::text, 'odm_', '') ILIKE $1
                        OR m.signature_data->'teacher'->>'hash' ILIKE $1
                        OR m.signature_data->'head'->>'hash' ILIKE $1
                        OR m.signature_data->>'hash' ILIKE $1
                    )
                    LIMIT 1
                `;
                const moRes = await pool.query(moQuery, [`%${searchStr}%`]);
                if (moRes.rowCount && moRes.rowCount > 0) {
                    const mo = moRes.rows[0];
                    const meta = mo.metadata || {};
                    const moSigs = mo.signature_data || {};
                    const sigs = [];

                    if (moSigs.teacher?.date) sigs.push({ n: meta.prof_nom || 'Enseignant', r: 'Enseignant', d: moSigs.teacher.date });
                    if (moSigs.head?.date || moSigs.date) sigs.push({ n: meta.ecole_chef_nom || "Chef d'Établissement", r: "Chef d'Établissement", d: moSigs.head?.date || moSigs.date });

                    const payload = {
                        id: mo.id,
                        mo: true,
                        s: (meta.eleve_nom || '') + ' ' + (meta.eleve_prenom || ''),
                        e: meta.ent_nom || '',
                        d: {
                            s: mo.date_start || meta.stage_date_debut,
                            f: mo.date_end || meta.stage_date_fin
                        },
                        sigs
                    };
                    return { payload, dbDetails: mo };
                }
                return null;
            };

            if (isOdmPrefix) {
                const moSearchStr = manualCode.replace('ODM', '');
                const omResult = await checkMissionOrder(moSearchStr);
                if (omResult) {
                    return <ValidState payload={omResult.payload} dbDetails={omResult.dbDetails} />;
                }
                return <ErrorState message="Ce code n'est associé à aucun Ordre de Mission valide." />;
            }

            // Normal Conventions Query
            const query = `
                SELECT id, status, metadata, created_at, date_start, date_end, type
                FROM conventions 
                WHERE (
                    id::text ILIKE $1 
                    OR REPLACE(id::text, '-', '') ILIKE $1 
                    OR REPLACE(REPLACE(id::text, 'conv_', ''), '-', '') ILIKE $1 
                )
                OR pdf_hash ILIKE $2
                OR metadata->>'attestation_signature_code' ILIKE $2
                OR metadata->>'attestationHash' ILIKE $2
                OR metadata->>'certificateHash' ILIKE $2
                OR EXISTS (
                    SELECT 1 FROM jsonb_each_text(COALESCE(metadata, '{}'::jsonb)) AS m(k, v)
                    WHERE v ILIKE $2 OR REPLACE(v, '-', '') ILIKE $2
                )
                OR (
                    jsonb_typeof(metadata->'signatures') = 'array' AND EXISTS (
                        SELECT 1 FROM jsonb_array_elements(metadata->'signatures') AS sig_arr
                        WHERE sig_arr->>'code' ILIKE $2 OR sig_arr->>'hash' ILIKE $2
                    )
                )
                LIMIT 1
            `;
            const values = [`%${manualCode}%`, `%${manualCode}%`];
            const res = await pool.query(query, values);

            if (res?.rowCount && res.rowCount > 0) {
                const convention = res.rows[0];
                const meta = convention.metadata || {};
                const payload = {
                    id: convention.id,
                    t: convention.type === 'PFMP_STANDARD' ? 'c' : 'a',
                    s: (meta.eleve_nom || '') + ' ' + (meta.eleve_prenom || ''),
                    e: meta.ent_nom || '',
                    d: {
                        s: convention.date_start || meta.stage_date_debut,
                        f: convention.date_end || meta.stage_date_fin
                    },
                    sigs: meta.signatures ? Object.entries(meta.signatures).map(([role, data]: [string, any]) => {
                        let name = data.name;
                        if (!name || name === role) {
                            if (role === 'student') name = `${meta.eleve_prenom} ${meta.eleve_nom}`;
                            else if (role === 'parent') name = meta.rep_legal_nom;
                            else if (role === 'teacher') name = meta.prof_nom;
                            else if (role === 'company_head' || role === 'company') name = meta.ent_rep_nom;
                            else if (role === 'tutor') name = meta.tuteur_nom;
                            else if (role === 'head') name = meta.ecole_chef_nom;
                        }
                        return {
                            n: name || role,
                            r: role,
                            d: data.signedAt
                        };
                    }).filter(s => s.d) : []
                };

                return <ValidState payload={payload} dbDetails={convention} />;
            }

            // Fallback: If not found in conventions, it could be a raw ODM hash without 'ODM' prefix
            const omFallbackResult = await checkMissionOrder(manualCode);
            if (omFallbackResult) {
                return <ValidState payload={omFallbackResult.payload} dbDetails={omFallbackResult.dbDetails} />;
            }

            return <ErrorState message="Ce code n'est associé à aucun document valide ou certificat répertorié." />;
        } catch (e) {
            console.error("Manual Verify Error:", e);
            return <ErrorState message="Erreur lors de la communication avec le serveur de vérification." />;
        }
    }

    // SCENARIO 2: QR Code Verification (Stateless + DB fallback)
    if (!encodedData || !signature) {
        return <ErrorState message="Paramètres manquants ou lien de vérification corrompu." />;
    }

    let payload: any = null;
    let isSigValid = false;

    try {
        const jsonString = Buffer.from(encodedData, 'base64url').toString('utf-8');
        payload = JSON.parse(jsonString);
        isSigValid = verifyData(payload, signature);
    } catch (e) {
        return <ErrorState message="Les données du document sont illisibles ou le format est obsolète." />;
    }

    if (!isSigValid) {
        return <InvalidState payload={payload} reason="Intégrité compromise : La signature ne correspond pas au contenu" />;
    }

    let dbStatus: 'VALID' | 'REVOKED' | 'NOT_FOUND' | 'IN_PROGRESS' = 'VALID';
    let dbDetails: any = null;

    try {
        if (payload.mo) {
            // For mission orders, the payload ID is the CONVENTION ID because it's linked dynamically
            const res = await pool.query('SELECT status, signature_data, updated_at FROM mission_orders WHERE convention_id = $1', [payload.id]);

            if (!res?.rowCount || res.rowCount === 0) {
                dbStatus = 'NOT_FOUND';
            } else {
                const row = res.rows[0];
                dbDetails = row;

                if (['REJECTED', 'CANCELLED'].includes(row.status)) {
                    dbStatus = 'REVOKED';
                } else if (row.status === 'SIGNED' || row.signature_data?.head?.hash) {
                    dbStatus = 'VALID';
                } else {
                    dbStatus = 'IN_PROGRESS';
                }
            }
        } else {
            const res = await pool.query('SELECT status, pdf_hash, updated_at, metadata FROM conventions WHERE id = $1', [payload.id]);

            if (!res?.rowCount || res.rowCount === 0) {
                dbStatus = 'NOT_FOUND';
            } else {
                const row = res.rows[0];
                dbDetails = row;

                if (['REJECTED', 'ANNULEE', 'CANCELLED'].includes(row.status)) {
                    dbStatus = 'REVOKED';
                }
                else if (['SIGNED_BY_SCHOOL', 'VALIDATED_HEAD', 'COMPLETED'].includes(row.status)) {
                    dbStatus = 'VALID';
                } else {
                    dbStatus = 'IN_PROGRESS';
                }
            }
        }
    } catch (e) {
        console.error("DB Verify Error:", e);
        return <ValidState payload={payload} warning="Le serveur central est temporairement indisponible. Vérification effectuée sur preuve locale uniquement." />;
    }

    if (dbStatus === 'NOT_FOUND') {
        return <ErrorState message="Ce document (ID technique) est introuvable." />;
    }

    if (dbStatus === 'REVOKED') {
        return <RevokedState payload={payload} />;
    }

    if (dbStatus === 'IN_PROGRESS') {
        return <ValidState payload={payload} warning="Document authentique mais cycle de signature incomplet." />;
    }

    return <ValidState payload={payload} dbDetails={dbDetails} />;
}

function SearchForm({ small }: { small?: boolean }) {
    return (
        <form action="/verify" method="GET" className={`space-y-4 w-full ${small ? 'max-w-xs' : 'max-w-sm'} mx-auto`}>
            <div className="text-left">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1 text-center">
                    Certificat d'Authenticité Numérique
                </label>
                <div className="flex gap-2 p-1 bg-gray-50 rounded-xl border border-gray-200 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                    <input
                        name="code"
                        type="text"
                        placeholder="Saisissez le code"
                        className="flex-1 bg-transparent border-none focus:ring-0 px-4 py-2 font-mono text-xs uppercase tracking-widest text-gray-700 text-center"
                        maxLength={32}
                        required
                    />
                    <button
                        type="submit"
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold transition-all shadow-md active:scale-95 text-[10px]"
                    >
                        Vérifier
                    </button>
                </div>
            </div>
        </form>
    );
}

function ErrorState({ message }: { message: string }) {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="bg-white p-10 rounded-2xl shadow-xl max-w-lg w-full text-center border border-red-100 ring-1 ring-red-50">
                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Info className="w-10 h-10 text-red-500" />
                </div>
                <h1 className="text-2xl font-black text-gray-900 mb-2">Vérification Échouée</h1>
                <p className="text-gray-500 mb-8">{message}</p>

                <div className="mb-8 p-6 bg-gray-50 rounded-2xl border border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 text-center">Essayer la saisie manuelle :</p>
                    <SearchForm />
                </div>

                <div className="space-y-4">
                    <Link href="/" className="block text-sm text-gray-400 hover:text-gray-600 transition-colors">
                        Retour au Dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
}

function RevokedState({ payload }: { payload: any }) {
    return (
        <div className="min-h-screen bg-red-100 flex flex-col items-center justify-center p-4">
            <div className="bg-white p-10 rounded-3xl shadow-2xl max-w-lg w-full text-center border-t-[12px] border-red-600">
                <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
                    <XCircle className="w-12 h-12 text-red-600" />
                </div>
                <h1 className="text-3xl font-black text-red-700 mb-6 uppercase tracking-tighter">Document Révoqué</h1>
                <p className="text-gray-700 text-lg mb-8 leading-relaxed">
                    Ce document a été marqué comme <span className="font-bold">non-conforme</span> ou <span className="font-bold">annulé</span> par l'administration scolaire.
                </p>

                <div className="mb-8 p-6 bg-gray-50 rounded-2xl border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mb-4">Vérifier un autre code :</p>
                    <SearchForm small />
                </div>

                <Link href="/verify" className="text-red-700 hover:underline font-bold">Retour à l'accueil de vérification</Link>
            </div>
        </div>
    );
}

function InvalidState({ payload, reason }: { payload: any, reason?: string }) {
    return (
        <div className="min-h-screen bg-orange-50 flex flex-col items-center justify-center p-4">
            <div className="bg-white p-10 rounded-3xl shadow-2xl max-w-lg w-full text-center border-t-[12px] border-orange-500">
                <div className="w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-8">
                    <AlertTriangle className="w-12 h-12 text-orange-600" />
                </div>
                <h1 className="text-3xl font-black text-orange-700 mb-4 tracking-tighter uppercase">Intégrité Compromise</h1>
                <p className="text-gray-600 mb-8 leading-relaxed">
                    La signature cryptographique ne correspond pas aux données affichées. Ce document a pu être modifié frauduleusement après sa signature.
                </p>

                <div className="mb-8 p-6 bg-gray-50 rounded-2xl border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mb-4">Tester un autre code d'authentification :</p>
                    <SearchForm small />
                </div>

                <Link href="/verify" className="bg-orange-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-orange-200">Essayer de nouveau</Link>
            </div>
        </div>
    );
}

function ValidState({ payload, dbDetails, warning }: { payload: any, dbDetails?: any, warning?: string }) {
    const typeLabel = payload.t === 'c' ? 'Convention de Stage' : payload.mo ? 'Ordre de Mission Permanent' : 'Attestation de Stage';
    const studentName = payload.s;
    const companyName = payload.e;
    const dateStart = payload.d?.s ? new Date(payload.d.s).toLocaleDateString('fr-FR') : 'Date inconnue';
    const dateEnd = payload.d?.f ? new Date(payload.d.f).toLocaleDateString('fr-FR') : 'Date inconnue';
    const dates = `${dateStart} - ${dateEnd}`;

    return (
        <div className="min-h-screen bg-blue-50/50 flex flex-col items-center justify-center p-4 py-12">
            <div className="bg-white rounded-[32px] shadow-2xl max-w-2xl w-full overflow-hidden border border-blue-100">
                {/* Header */}
                <div className="bg-blue-600 p-10 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                        <svg viewBox="0 0 100 100" className="w-full h-full"><circle cx="50" cy="50" r="40" fill="none" stroke="white" strokeWidth="0.5" /></svg>
                    </div>
                    <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-blue-900/40 relative z-10 transition-transform duration-500 hover:scale-110">
                        <ShieldCheck className="w-12 h-12 text-blue-600" />
                    </div>
                    <h1 className="text-3xl font-black text-white mb-2 tracking-tighter">CERTIFIÉ CONFORME</h1>
                    <div className="inline-flex items-center gap-2 bg-blue-500/30 px-4 py-1.5 rounded-full text-blue-100 text-xs font-bold uppercase tracking-widest">
                        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                        Signature Numérique Active
                    </div>
                </div>

                {/* Content */}
                <div className="p-10 space-y-8">
                    <div className="text-center">
                        <p className="text-gray-400 text-sm font-medium leading-relaxed max-w-md mx-auto">
                            Ce document a été cryptographiquement scellé par l'académie via <span className="text-blue-600 font-bold">Pledgeum Trust</span>. Son contenu est garanti authentique et inaltéré.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InfoRow icon={FileText} label="Type de Document" value={typeLabel} />
                        <InfoRow icon={User} label="Élève" value={studentName} color="green" />
                        <InfoRow icon={Building2} label="Entreprise" value={companyName} color="orange" />
                        <InfoRow icon={Calendar} label="Période" value={dates} color="purple" />
                    </div>

                    {payload.sigs && payload.sigs.length > 0 && (
                        <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                            <h3 className="font-black text-gray-400 text-[10px] uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                <Search className="w-3 h-3" />
                                Signataires Certifiés
                            </h3>
                            <div className="space-y-4">
                                {payload.sigs.map((sig: any, i: number) => (
                                    <div key={i} className="flex justify-between items-center group">
                                        <div>
                                            <span className="block font-bold text-gray-800 text-sm group-hover:text-blue-600 transition-colors">{sig.n || 'Signataire Anonyme'}</span>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{sig.r}</span>
                                        </div>
                                        <div className="text-right flex flex-col items-end">
                                            <span className="text-xs font-bold text-green-600 mb-0.5">✅ Signé</span>
                                            <span className="text-[10px] font-mono text-gray-300">
                                                {sig.d ? new Date(sig.d).toLocaleDateString('fr-FR') : 'Date inconnue'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {warning ? (
                        <div className="bg-amber-50 p-4 rounded-xl text-amber-800 text-[11px] font-bold flex items-start gap-3 border border-amber-200 leading-relaxed shadow-sm">
                            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                            <span>{warning}</span>
                        </div>
                    ) : (
                        <div className="bg-green-50 p-4 rounded-xl text-green-800 text-[11px] font-bold flex items-start gap-3 border border-green-200 leading-relaxed shadow-sm">
                            <ShieldCheck className="w-4 h-4 shrink-0 text-green-500" />
                            <span>Double vérification complète : Concordance exacte entre la preuve locale et les registres du serveur central.</span>
                        </div>
                    )}

                    <div className="pt-8 border-t border-gray-100">
                        <Link href="/verify" className="block text-center text-sm font-bold text-gray-400 hover:text-blue-600 transition-colors uppercase tracking-widest">
                            Vérifier un autre document
                        </Link>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 p-6 text-center text-[10px] text-gray-400 font-mono tracking-tighter uppercase opacity-50">
                    Trust Hash: {payload.id?.substring(0, 16) || 'N/A'} • Pledgeum V1.0 • {new Date().getFullYear()}
                </div>
            </div>
        </div>
    );
}

function InfoRow({ icon: Icon, label, value, color = "blue" }: { icon: any, label: string, value: string, color?: string }) {
    const colorClasses: Record<string, string> = {
        blue: "bg-blue-50 text-blue-600 shadow-blue-100",
        green: "bg-green-50 text-green-600 shadow-green-100",
        orange: "bg-orange-50 text-orange-600 shadow-orange-100",
        purple: "bg-purple-50 text-purple-600 shadow-purple-100",
    };

    return (
        <div className="flex items-center gap-4 p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-100 transition-all group">
            <div className={`w-12 h-12 ${colorClasses[color]} rounded-xl flex items-center justify-center flex-shrink-0 shadow-inner group-hover:scale-110 transition-transform`}>
                <Icon className="w-6 h-6" />
            </div>
            <div className="min-w-0">
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-0.5">{label}</p>
                <p className="text-gray-900 font-bold truncate text-sm">{value}</p>
            </div>
        </div>
    );
}
