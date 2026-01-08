import { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { X, Check, AlertCircle, Building2 } from 'lucide-react';
import { PartnerCompany } from '@/store/school';

interface PartnerImportReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: PartnerCompany[];
    onConfirm: () => void;
}

export function PartnerImportReviewModal({ isOpen, onClose, data, onConfirm }: PartnerImportReviewModalProps) {
    if (!isOpen) return null;

    const [isConfirming, setIsConfirming] = useState(false);

    const handleConfirm = async () => {
        setIsConfirming(true);
        // Simulate a small delay if needed or just call confirm
        await new Promise(resolve => setTimeout(resolve, 500));
        onConfirm();
        setIsConfirming(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose} />

                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div className="sm:flex sm:items-start">
                            <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                                <Building2 className="h-6 w-6 text-blue-600" aria-hidden="true" />
                            </div>
                            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                                <h3 className="text-lg leading-6 font-medium text-gray-900">
                                    Confirmer l'import des Partenaires
                                </h3>
                                <div className="mt-2">
                                    <p className="text-sm text-gray-500 mb-4">
                                        Voici les entreprises détectées dans votre fichier CSV. Veuillez vérifier les données avant de valider l'import.
                                    </p>

                                    <div className="max-h-[60vh] overflow-y-auto border border-gray-200 rounded-md">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50 sticky top-0">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entreprise (API)</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SIRET</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Activité (CSV)</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Métiers (CSV)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {data.map((partner) => (
                                                    <tr key={partner.siret}>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="text-sm font-medium text-gray-900">{partner.name}</div>
                                                            <div className="text-xs text-gray-500">{partner.address} {partner.city}</div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            {partner.siret}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            {partner.activity}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-gray-500">
                                                            <div className="flex flex-wrap gap-1">
                                                                {partner.jobs.map((job, idx) => (
                                                                    <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                                        {job}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="mt-4 p-4 bg-blue-50 rounded-md">
                                        <div className="flex">
                                            <div className="flex-shrink-0">
                                                <AlertCircle className="h-5 w-5 text-blue-400" aria-hidden="true" />
                                            </div>
                                            <div className="ml-3">
                                                <h3 className="text-sm font-medium text-blue-800">Résumé</h3>
                                                <div className="mt-2 text-sm text-blue-700">
                                                    <p>
                                                        <strong>{data.length}</strong> entreprises prêtes à être importées.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                        <button
                            type="button"
                            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                            onClick={handleConfirm}
                            disabled={isConfirming}
                        >
                            {isConfirming ? 'Import en cours...' : 'Confirmer l\'import'}
                        </button>
                        <button
                            type="button"
                            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                            onClick={onClose}
                            disabled={isConfirming}
                        >
                            Annuler
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

