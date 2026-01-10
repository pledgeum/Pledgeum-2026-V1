import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useUserStore } from '@/store/user';
import { ShieldCheck, ArrowRight, BookOpen, X } from 'lucide-react';

interface TosModalProps {
    isOpen?: boolean;
    onClose?: () => void;
}

export function TosModal({ isOpen = false, onClose }: TosModalProps) {
    const { user } = useAuth();
    const { hasAcceptedTos, acceptTos } = useUserStore();
    const [isLoading, setIsLoading] = useState(false);

    // If status is unknown (loading), do not render yet
    if (hasAcceptedTos === null) return null;

    // Determine if we are in blocking mode (mandatory acceptance) or view mode
    const isBlocking = hasAcceptedTos === false;
    const isVisible = isBlocking || isOpen;

    // EMERGENCY BYPASS FOR ADMIN
    if (user?.email === 'pledgeum@gmail.com') return null;

    if (!user || !isVisible) return null;

    const handleAccept = async () => {
        setIsLoading(true);
        try {
            await acceptTos(user.uid);
        } catch (error) {
            console.error("Error accepting TOS:", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden border border-gray-200">
                {/* Header */}
                <div className="bg-blue-600 px-8 py-6 flex justify-between items-start">
                    <div className="flex items-center space-x-4">
                        <div className="bg-white/20 p-3 rounded-full">
                            <ShieldCheck className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white">
                                {isBlocking ? "Bienvenue sur PLEDGEUM" : "Respect RGPD"}
                            </h2>
                            <p className="text-blue-100">
                                {isBlocking ? "Avant de commencer, veuillez accepter nos conditions." : "Engagements de protection des données."}
                            </p>
                        </div>
                    </div>
                    {!isBlocking && onClose && (
                        <button onClick={onClose} className="text-blue-100 hover:text-white transition-colors">
                            <X className="w-6 h-6" />
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="p-8 space-y-6">
                    <div className="bg-gray-50 border-l-4 border-blue-600 p-4 rounded-r-lg">
                        <p className="text-gray-800 font-medium">
                            La protection de vos données personnelles et le respect de votre vie privée sont au cœur de nos engagements.
                        </p>
                    </div>

                    <div className="space-y-4 text-gray-600 text-sm leading-relaxed">
                        <p>
                            En utilisant la plateforme <strong>PLEDGEUM</strong> pour la gestion des conventions PFMP, vous acceptez le traitement de vos données personnelles nécessaires au bon fonctionnement du service.
                        </p>
                        <p>
                            Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez de droits d'accès, de rectification et d'effacement de vos données.
                        </p>
                        <a
                            href="https://www.cnil.fr/fr/comprendre-le-rgpd/les-six-grands-principes-du-rgpd"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center p-4 bg-blue-50 rounded-lg text-blue-700 hover:bg-blue-100 transition-colors group"
                        >
                            <BookOpen className="w-5 h-5 mr-3 flex-shrink-0" />
                            <span className="font-bold underline decoration-blue-400 group-hover:decoration-blue-700">Lire les 6 grands principes du RGPD sur le site de la CNIL</span>
                            <ArrowRight className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                        </a>
                    </div>

                    {/* Actions */}
                    <div className="pt-4 flex flex-col items-center space-y-3">
                        {isBlocking ? (
                            <button
                                onClick={handleAccept}
                                disabled={isLoading}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold py-4 rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? (
                                    <span>Traitement en cours...</span>
                                ) : (
                                    <>
                                        <span>J'ai lu et j'accepte les conditions</span>
                                        <ArrowRight className="w-5 h-5" />
                                    </>
                                )}
                            </button>
                        ) : (
                            <button
                                onClick={onClose}
                                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 text-lg font-bold py-3 rounded-lg transition-all flex items-center justify-center"
                            >
                                Fermer
                            </button>
                        )}
                        {isBlocking && (
                            <p className="text-xs text-gray-400 text-center">
                                En cliquant sur le bouton ci-dessus, vous reconnaissez avoir pris connaissance de nos conditions d'utilisation et de notre politique de confidentialité.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
