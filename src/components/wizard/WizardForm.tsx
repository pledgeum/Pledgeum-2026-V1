'use client';

import { useState } from 'react';
import { useWizardStore } from '@/store/wizard';
import { useConventionStore } from '@/store/convention';
import { useUserStore } from '@/store/user';
import { Stepper } from './Stepper';
import { Step1School } from './Step1School';
import { Step2Student } from './Step2Student';
import { Step3Company } from './Step3Company';
import { Step4Internship } from './Step4Internship';
import { cn } from '@/lib/utils';
import { Wand2, CheckCircle, Eraser } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { SignatureModal } from '@/components/ui/SignatureModal';

import dynamic from 'next/dynamic';

const PdfPreview = dynamic(() => import('../pdf/PdfPreview'), {
    ssr: false,
    loading: () => <div className="p-10 text-center">Génération du PDF en cours...</div>
});

interface WizardFormProps {
    onSuccess?: () => void;
}

export function WizardForm({ onSuccess }: WizardFormProps) {
    const { currentStep, setData, data } = useWizardStore();

    const loadDemoData = () => {
        setData({
            ecole_nom: "Lycée Professionnel Jean Jaurès",
            ecole_adresse: "123 Avenue de la République, 75011 Paris",
            ecole_tel: "0143123456",
            ecole_chef_nom: "Mme Martin",
            ecole_chef_email: "direction@lycee-jaures.fr",
            prof_nom: "M. Dupont",
            prof_email: "prof.referent@lycee-jaures.fr",

            eleve_nom: "Dubois",
            eleve_prenom: "Thomas",
            eleve_date_naissance: "2007-05-15", // Mineur
            eleve_adresse: "10 Rue des Lilas, 75020 Paris",
            eleve_email: "thomas.dubois@email.com",
            eleve_classe: "1ère Bac Pro SN",
            diplome_intitule: "Bac Pro Systèmes Numériques",

            rep_legal_nom: "M. Dubois Pierre",
            rep_legal_email: "pierre.dubois@email.com",
            rep_legal_adresse: "10 Rue des Lilas, 75020 Paris",
            est_mineur: true,

            ent_nom: "Tech Solutions SAS",
            ent_siret: "12345678900012",
            ent_adresse: "45 Boulevard Haussmann, 75009 Paris",
            ent_rep_nom: "Mme Leroy",
            ent_rep_fonction: "DRH",
            ent_rep_email: "drh@techsolutions.fr",
            tuteur_nom: "M. Bernard",
            tuteur_fonction: "Chef de projet",
            tuteur_email: "tuteur@techsolutions.fr",

            stage_date_debut: "2024-06-03",
            stage_date_fin: "2024-06-28",
            stage_duree_heures: 140,
            stage_activites: "Installation et configuration de postes informatiques, assistance utilisateurs, découverte du réseau d'entreprise.",
            stage_horaires: {
                'Lundi': { matin_debut: '08:00', matin_fin: '12:00', apres_midi_debut: '14:00', apres_midi_fin: '17:00' },
                'Mardi': { matin_debut: '08:00', matin_fin: '12:00', apres_midi_debut: '14:00', apres_midi_fin: '17:00' },
                'Mercredi': { matin_debut: '08:00', matin_fin: '12:00', apres_midi_debut: '14:00', apres_midi_fin: '17:00' },
                'Jeudi': { matin_debut: '08:00', matin_fin: '12:00', apres_midi_debut: '14:00', apres_midi_fin: '17:00' },
                'Vendredi': { matin_debut: '08:00', matin_fin: '12:00', apres_midi_debut: '14:00', apres_midi_fin: '17:00' },
                'Samedi': { matin_debut: '', matin_fin: '', apres_midi_debut: '', apres_midi_fin: '' },
            }
        });
    };

    const [isSuccess, setIsSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { submitConvention } = useConventionStore();
    const { addNotification, email } = useUserStore();
    const { reset } = useWizardStore();
    const { user } = useAuth();

    const sigCanvas = useRef<SignatureCanvas>(null);
    const [signature, setSignature] = useState<string | null>(null);
    const [isSigModalOpen, setIsSigModalOpen] = useState(false);

    const clearSignature = () => {
        setSignature(null);
    };

    const handleSign = (method: 'canvas' | 'otp', signatureImage?: string) => {
        if (signatureImage) {
            setSignature(signatureImage);
            setIsSigModalOpen(false);
        }
    };

    const handleSubmit = async () => {
        if (!data.eleve_email) return;

        if (!signature) {
            setError("Veuillez signer la convention avant de valider.");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // Include signature in data
            const submissionData = {
                ...data,
                signatures: {
                    ...data.signatures,
                    studentImg: signature
                }
            };

            await submitConvention(submissionData as any, data.eleve_email, user ? user.uid : 'bypassed_user');
            addNotification({
                title: 'Convention envoyée',
                message: 'Votre demande a été transmise à l\'enseignant référent/professeur principal pour validation (sauvegardée dans Firestore).',
            });

            setIsSuccess(true);

            // Wait 2 seconds then redirect
            setTimeout(() => {
                reset();
                if (onSuccess) onSuccess();
            }, 2000);
        } catch (err) {
            console.error(err);
            setError("Une erreur est survenue lors de l'envoi de la convention. Veuillez réessayer.");
        } finally {
            setIsLoading(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center p-8 bg-white rounded-2xl shadow-xl max-w-md w-full animate-in fade-in zoom-in duration-300">
                    <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
                        <CheckCircle className="h-10 w-10 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Convention Envoyée !</h2>
                    <p className="text-gray-500 mb-6">
                        Votre demande a été transmise avec succès. Vous allez être redirigé vers le tableau de bord...
                    </p>
                    <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 animate-pulse w-full origin-left duration-[2000ms] transition-all"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-4 sm:px-6 lg:px-8">
            <div className="w-full max-w-4xl">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-extrabold text-blue-900 tracking-tight">Convention PFMP</h1>
                    {(email === 'demo@pledgeum.fr' || email === 'pledgeum@gmail.com') && (
                        <button
                            onClick={loadDemoData}
                            className="flex items-center text-sm text-blue-600 hover:text-blue-800 transition-colors"
                            title="Pré-remplir avec des données de test"
                        >
                            <Wand2 className="w-4 h-4 mr-1" />
                            Mode Démo
                        </button>
                    )}
                </div>

                <Stepper />

                <div className="mt-8">
                    {currentStep === 1 && <Step1School />}
                    {currentStep === 2 && <Step2Student />}
                    {currentStep === 3 && <Step3Company />}
                    {currentStep === 4 && <Step4Internship />}

                    {currentStep === 5 && (
                        <div className="text-center p-10 bg-white rounded-xl shadow space-y-6 pb-32">
                            <div>
                                <h2 className="text-2xl font-bold text-green-600 mb-2">Formulaire Complété !</h2>
                                <p className="text-gray-600">Veuillez vérifier le document ci-dessous avant de l'envoyer.</p>
                            </div>

                            <PdfPreview data={{ ...data, signatures: { ...data.signatures, studentImg: signature || undefined } }} />

                            <div className="border-t border-gray-200 pt-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-4 text-center">Signature de l'élève</h3>
                                <div className="flex flex-col items-center space-y-3">
                                    {signature ? (
                                        <div className="flex flex-col items-center">
                                            <img src={signature} alt="Signature" className="max-h-24 border rounded shadow-sm" />
                                            <button
                                                type="button"
                                                onClick={clearSignature}
                                                className="mt-2 text-sm text-red-500 hover:text-red-700 flex items-center"
                                            >
                                                <Eraser className="w-4 h-4 mr-1" />
                                                Effacer et recommencer
                                            </button>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-500 italic">En attente de signature...</p>
                                    )}
                                </div>
                            </div>

                            <SignatureModal
                                isOpen={isSigModalOpen}
                                onClose={() => setIsSigModalOpen(false)}
                                onSign={handleSign}
                                signeeName={`${data.eleve_prenom} ${data.eleve_nom}`}
                                signeeEmail={data.eleve_email || ''}
                                conventionId={`temp_${Date.now()}`} // Temporary ID for OTP association
                            />

                            {/* Floating Footer using Portal or Fixed Position */}
                            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-40 flex flex-col items-center justify-center gap-3 safe-area-bottom">
                                {error && (
                                    <p className="text-red-600 text-sm font-medium animate-pulse">{error}</p>
                                )}

                                {!signature ? (
                                    <button
                                        onClick={() => setIsSigModalOpen(true)}
                                        className="w-full max-w-sm px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg transition-colors flex items-center justify-center"
                                    >
                                        <Wand2 className="w-5 h-5 mr-2" />
                                        Signer la convention
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleSubmit}
                                        disabled={isLoading}
                                        className={`w-full max-w-sm px-8 py-3 bg-green-600 text-white font-bold rounded-xl shadow-lg flex items-center justify-center ${isLoading ? 'opacity-75 cursor-not-allowed' : 'hover:bg-green-700 hover:scale-105 transition-all'}`}
                                    >
                                        {isLoading ? (
                                            <>
                                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                                Envoi en cours...
                                            </>
                                        ) : "Valider et Envoyer à l'Enseignant"}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
