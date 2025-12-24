import { useState } from 'react';
import { X, Check, MapPin, AlertTriangle, FileText, Calendar } from 'lucide-react';
import { useMissionOrderStore, MissionOrder } from '@/store/missionOrder';
import { useConventionStore } from '@/store/convention';
import { useUserStore } from '@/store/user';
import { SignatureModal } from '@/components/ui/SignatureModal';

interface MissionOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function MissionOrderModal({ isOpen, onClose }: MissionOrderModalProps) {
    const { missionOrders, signMissionOrders } = useMissionOrderStore();
    const { conventions } = useConventionStore(); // To get student names
    const { name } = useUserStore();

    // States
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showWarning, setShowWarning] = useState(false);
    const [ordersToValidate, setOrdersToValidate] = useState<MissionOrder[]>([]);
    const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);

    if (!isOpen) return null;

    const pendingOrders = missionOrders.filter(o => o.status === 'PENDING');

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === pendingOrders.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(pendingOrders.map(o => o.id)));
    };

    const handlePrepareSignature = () => {
        const selectedOrders = pendingOrders.filter(o => selectedIds.has(o.id));
        if (selectedOrders.length === 0) return;

        // GUARD: Check Distance > 100km
        const riskyOrders = selectedOrders.filter(o => o.distanceKm > 100);

        if (riskyOrders.length > 0) {
            setOrdersToValidate(selectedOrders);
            setShowWarning(true);
        } else {
            setOrdersToValidate(selectedOrders);
            setIsSignatureModalOpen(true);
        }
    };

    const handleConfirmWarning = (removeRisky: boolean) => {
        if (removeRisky) {
            // Remove risky ones and proceed with the rest
            const safeOrders = ordersToValidate.filter(o => o.distanceKm <= 100);
            if (safeOrders.length === 0) {
                // If nothing left, close warning and reset
                setShowWarning(false);
                return;
            }
            setOrdersToValidate(safeOrders);
        }
        // If not removing, we validate ALL (exceptional validation)
        setShowWarning(false);
        setIsSignatureModalOpen(true);
    };

    const handleSign = (signatureImg: string) => {
        signMissionOrders(ordersToValidate.map(o => o.id), signatureImg, name || "Chef d'Établissement");
        setIsSignatureModalOpen(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center">
                        <FileText className="w-5 h-5 mr-2 text-blue-600" />
                        Ordres de Mission à Valider
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {pendingOrders.length === 0 ? (
                        <p className="text-center text-gray-500 italic py-10">Aucun ordre de mission en attente.</p>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-between mb-2">
                                <button onClick={toggleSelectAll} className="text-sm text-blue-600 font-medium hover:underline">
                                    {selectedIds.size === pendingOrders.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                                </button>
                                <span className="text-sm text-gray-500">{selectedIds.size} sélectionné(s)</span>
                            </div>

                            {pendingOrders.map(order => {
                                const convention = conventions.find(c => c.id === order.conventionId);
                                const isRisky = order.distanceKm > 100;

                                return (
                                    <div key={order.id}
                                        className={`flex items-start p-4 rounded-lg border-2 cursor-pointer transition-colors ${selectedIds.has(order.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-blue-200'}`}
                                        onClick={() => toggleSelection(order.id)}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(order.id)}
                                            readOnly
                                            className="mt-1 mr-4 h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                                        />
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start">
                                                <h4 className="font-bold text-gray-900">
                                                    Mission : {order.teacherId} {/* Email as name for now */}
                                                </h4>
                                                {isRisky && (
                                                    <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full font-bold flex items-center">
                                                        <AlertTriangle className="w-3 h-3 mr-1" />
                                                        {order.distanceKm} km
                                                    </span>
                                                )}
                                                {!isRisky && (
                                                    <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">
                                                        {order.distanceKm} km
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-600 mt-1">
                                                Suivi de : <span className="font-medium">{convention ? `${convention.eleve_prenom} ${convention.eleve_nom}` : 'Élève inconnu'}</span>
                                            </p>
                                            <div className="text-xs text-gray-500 mt-2 space-y-1">
                                                <p className="flex items-center"><MapPin className="w-3 h-3 mr-1" /> {order.companyAddress}</p>
                                                <p className="flex items-center"><Calendar className="w-3 h-3 mr-1" /> Créé le {new Date(order.createdAt).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end">
                    <button
                        onClick={handlePrepareSignature}
                        disabled={selectedIds.size === 0}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg shadow disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                        <Check className="w-4 h-4 mr-2" /> Valider et Signer la sélection
                    </button>
                </div>
            </div>

            {/* Warning Modal */}
            {showWarning && (
                <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg max-w-lg w-full p-6 shadow-2xl skew-y-0 transform transition-all">
                        <div className="flex items-center mb-4 text-red-600">
                            <AlertTriangle className="w-8 h-8 mr-3" />
                            <h3 className="text-lg font-bold">Attention : Distances Excessives</h3>
                        </div>
                        <p className="text-gray-700 mb-4">
                            Certains ordres de mission sélectionnés impliquent un déplacement supérieur à <span className="font-bold">100 km</span>.
                        </p>
                        <div className="bg-red-50 p-3 rounded mb-6 max-h-40 overflow-y-auto">
                            <ul className="list-disc list-inside text-sm text-red-800 space-y-1">
                                {ordersToValidate.filter(o => o.distanceKm > 100).map(o => (
                                    <li key={o.id}>
                                        {o.teacherId} - {o.distanceKm} km
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => handleConfirmWarning(true)}
                                className="w-full py-2 px-4 bg-white border border-gray-300 text-gray-700 font-medium rounded hover:bg-gray-50"
                            >
                                Exclure les ODM {'>'} 100km et signer le reste
                            </button>
                            <button
                                onClick={() => handleConfirmWarning(false)}
                                className="w-full py-2 px-4 bg-red-600 text-white font-bold rounded hover:bg-red-700 shadow"
                            >
                                Confirmer et Valider TOUT (Exceptionnel)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Signature Pad */}
            <SignatureModal
                isOpen={isSignatureModalOpen}
                onClose={() => setIsSignatureModalOpen(false)}
                onSign={handleSign}
                conventionId="bulk-odm" // Dummy ID
                signeeName={name || (name === 'TEST (Moi-même)' ? 'Admin Test' : "Chef d'Établissement")}
                signeeEmail={useUserStore.getState().email === 'pledgeum@gmail.com' ? 'pledgeum@gmail.com' : "chef@ecole.fr"} // Dynamic for test
                hideOtp={true} // Simple signature for bulk internally? Or full process? Let's hide OTP for bulk efficiency for now
            />
        </div>
    );
}
