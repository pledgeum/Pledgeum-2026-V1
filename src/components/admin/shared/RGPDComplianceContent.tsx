import React from 'react';
import { ShieldCheck, FileUp } from 'lucide-react';

export const RGPDComplianceContent: React.FC = () => {
    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
                <h4 className="text-xl font-bold text-gray-900 mb-6 flex items-center border-b border-gray-100 pb-4">
                    <ShieldCheck className="w-6 h-6 mr-3 text-purple-600" />
                    Conformité RGPD : Facilitez la mise à jour de votre registre
                </h4>

                <div className="prose prose-sm text-gray-600 mb-8 max-w-none">
                    <p className="font-medium text-gray-900 mb-2">Madame, Monsieur le Chef d'établissement,</p>
                    <p className="mb-4">
                        Comme vous le savez, votre établissement tient à jour un <strong>Registre des Activités de Traitement</strong> qui recense l'ensemble des fichiers (élèves, personnels, cantine, etc.) gérés par votre structure.
                    </p>
                    <p className="mb-4">
                        L'utilisation de l'application <strong>Pledgeum</strong> constitue un nouveau traitement de données à ajouter à ce document existant. Pour vous faire gagner du temps et simplifier vos démarches de conformité, nous avons synthétisé ci-dessous les informations techniques prêtes à être reportées dans votre registre.
                    </p>
                </div>

                <div className="bg-purple-50 rounded-lg border border-purple-100 overflow-hidden">
                    <div className="bg-purple-100 px-4 py-3 border-b border-purple-200">
                        <h5 className="font-bold text-purple-900 text-sm flex items-center">
                            <FileUp className="w-4 h-4 mr-2" />
                            Les éléments à copier/coller dans votre registre :
                        </h5>
                    </div>
                    <div className="divide-y divide-purple-200/50">
                        <div className="grid grid-cols-1 md:grid-cols-3 p-4 hover:bg-white/50 transition-colors">
                            <div className="font-semibold text-gray-900 text-sm md:col-span-1">Rubrique du registre</div>
                            <div className="text-gray-700 text-sm md:col-span-2">Informations concernant Pledgeum</div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 p-4 hover:bg-white/50 transition-colors">
                            <div className="font-semibold text-gray-900 text-sm md:col-span-1">Finalité</div>
                            <div className="text-gray-700 text-sm md:col-span-2 space-y-1">
                                <p>Gestion de conventions de stage</p>
                                <p>Gestion et suivi des stages et relation alumni au sein de l'établissement.</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 p-4 hover:bg-white/50 transition-colors">
                            <div className="font-semibold text-gray-900 text-sm md:col-span-1">Catégories de données</div>
                            <div className="text-gray-700 text-sm md:col-span-2">
                                <ul className="list-disc list-inside space-y-1">
                                    <li><strong>Identité :</strong> Nom, Prénom, Classe.</li>
                                    <li><strong>Fonction Coordonnées :</strong> Email, Téléphone.</li>
                                    <li><strong>Données de vie scolaire :</strong> absences en stage.</li>
                                    <li><strong>Données économiques :</strong> Remboursement des frais.</li>
                                </ul>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 p-4 hover:bg-white/50 transition-colors">
                            <div className="font-semibold text-gray-900 text-sm md:col-span-1">Destinataires</div>
                            <div className="text-gray-700 text-sm md:col-span-2">
                                <ul className="list-disc list-inside space-y-1">
                                    <li>Services administratifs et comptables de l'établissement.</li>
                                    <li>La société éditrice de Pledgeum.</li>
                                </ul>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 p-4 hover:bg-white/50 transition-colors">
                            <div className="font-semibold text-gray-900 text-sm md:col-span-1">Durée de conservation</div>
                            <div className="text-gray-700 text-sm md:col-span-2">
                                Les données sont conservées pendant la durée de la scolarité de l'élève + 1 an ou jusqu'à désinscription puis archivées ou supprimées selon les obligations légales en vigueur.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
