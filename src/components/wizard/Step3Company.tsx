'use client';

import { z } from 'zod';
import { StepWrapper } from './StepWrapper';
import { conventionSchema } from '@/types/schema';
import { useWizardStore } from '@/store/wizard';
import { fetchCompanyBySiret } from '@/lib/companyApi';
import { Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

const stepSchema = conventionSchema.pick({
    ent_nom: true,
    ent_pays: true,
    ent_siret: true,
    ent_adresse: true,
    ent_code_postal: true,
    ent_ville: true,
    ent_rep_nom: true,
    ent_rep_fonction: true,
    ent_rep_email: true,
    tuteur_meme_personne: true,
    tuteur_nom: true,
    tuteur_fonction: true,
    tuteur_email: true,
    frais_restauration: true,
    frais_transport: true,
    frais_hebergement: true,
    gratification_montant: true,
});

type Step3Data = z.infer<typeof stepSchema>;

export function Step3Company() {
    const { setData, nextStep } = useWizardStore();
    const [isSearchingSiret, setIsSearchingSiret] = useState(false);
    const [searchStatus, setSearchStatus] = useState<'idle' | 'success' | 'not_found' | 'error'>('idle');

    const handleNext = (data: Step3Data) => {
        setData(data);
        nextStep();
    };

    return (
        <StepWrapper<Step3Data>
            title="L'Entreprise d'Accueil"
            description="Coordonnées de l'entreprise et du tuteur."
            schema={stepSchema}
            onNext={handleNext}
        >
            {(form) => {
                const pays = form.watch('ent_pays');
                const isFrance = !pays || pays === 'France';

                const siret = form.watch('ent_siret');
                const isSamePerson = form.watch('tuteur_meme_personne');
                const repNom = form.watch('ent_rep_nom');
                const repFonction = form.watch('ent_rep_fonction');
                const repEmail = form.watch('ent_rep_email');

                useEffect(() => {
                    if (isSamePerson) {
                        form.setValue('tuteur_nom', repNom || '');
                        form.setValue('tuteur_fonction', repFonction || '');
                        form.setValue('tuteur_email', repEmail || '');
                    }
                }, [isSamePerson, repNom, repFonction, repEmail, form]);

                const performSearch = async (siretValue: string, isManual: boolean = false) => {
                    const cleanSiret = siretValue ? siretValue.replace(/[^0-9]/g, '') : '';

                    if (cleanSiret.length !== 14) {
                        if (isManual) {
                            alert(`Le numéro de SIRET doit comporter 14 chiffres (actuellement ${cleanSiret.length}).`);
                        }
                        return;
                    }

                    if (isNaN(Number(cleanSiret))) {
                        return;
                    }

                    setIsSearchingSiret(true);
                    setSearchStatus('idle');
                    try {
                        const company = await fetchCompanyBySiret(cleanSiret);
                        if (company) {
                            form.setValue('ent_nom', company.nom_complet);
                            form.setValue('ent_adresse', company.adresse);
                            form.setValue('ent_code_postal', company.code_postal || '');
                            form.setValue('ent_ville', company.ville || '');
                            setSearchStatus('success');
                        } else {
                            if (isManual) alert("Aucune entreprise trouvée pour ce numéro de SIRET.");
                            setSearchStatus('not_found');
                        }
                    } catch (err) {
                        console.error(err);
                        if (isManual) alert("Erreur technique lors de la recherche.");
                        setSearchStatus('error');
                    } finally {
                        setIsSearchingSiret(false);
                    }
                };

                useEffect(() => {
                    // Only auto-search if length is exactly 14
                    const clean = siret ? siret.replace(/[^0-9]/g, '') : '';
                    if (clean.length === 14) {
                        performSearch(siret || '', false);
                    }
                }, [siret]);

                const handleManualSearch = () => {
                    performSearch(form.getValues('ent_siret') || '', true);
                };

                return (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Pays de l'entreprise</label>
                            <select
                                {...form.register('ent_pays')}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                            >
                                <option value="France">France</option>
                                <option value="Allemagne">Allemagne</option>
                                <option value="Espagne">Espagne</option>
                                <option value="Royaume-Uni">Royaume-Uni</option>
                                <option value="Italie">Italie</option>
                                <option value="Belgique">Belgique</option>
                                <option value="Autre">Autre</option>
                            </select>
                        </div>

                        {isFrance ? (
                            <div className="relative md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700">SIRET (14 chiffres) - Remplissage Automatique</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            {...form.register('ent_siret')}
                                            maxLength={20}
                                            placeholder="Entrez le SIRET..."
                                            className="mt-1 block w-full rounded-md border-blue-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border pr-10 bg-blue-50"
                                        />
                                        {isSearchingSiret && (
                                            <div className="absolute right-3 top-3">
                                                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleManualSearch}
                                        className="mt-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center gap-2"
                                    >
                                        <Search className="w-4 h-4" />
                                        Rechercher
                                    </button>
                                </div>
                                {form.formState.errors.ent_siret && <p className="text-red-500 text-xs mt-1">{form.formState.errors.ent_siret.message}</p>}
                                {searchStatus === 'success' && <p className="text-green-600 text-xs mt-1 font-medium">✅ Entreprise trouvée : Informations remplies.</p>}
                                {searchStatus === 'not_found' && <p className="text-amber-600 text-xs mt-1 font-medium">⚠️ Aucune entreprise trouvée pour ce SIRET.</p>}
                                {searchStatus === 'error' && <p className="text-red-600 text-xs mt-1 font-medium">❌ Une erreur est survenue lors de la recherche.</p>}
                                <p className="text-xs text-gray-500 mt-1">Saisissez le SIRET pour remplir automatiquement le nom et l'adresse.</p>
                            </div>
                        ) : (
                            <div className="md:col-span-2 bg-yellow-50 p-3 rounded-md border border-yellow-200">
                                <p className="text-sm text-yellow-800">
                                    Pour les entreprises étrangères, la recherche par SIRET est désactivée. Veuillez saisir les informations manuellement.
                                </p>
                            </div>
                        )}

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Raison Sociale</label>
                            <input
                                {...form.register('ent_nom')}
                                placeholder="Ex: SARL ..."
                                className={cn(
                                    "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border",
                                    form.formState.errors.ent_nom && "border-red-500 focus:border-red-500 focus:ring-red-500"
                                )}
                            />
                            {form.formState.errors.ent_nom && <p className="text-red-500 text-xs mt-1">{form.formState.errors.ent_nom.message}</p>}
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Adresse du Siège {isFrance ? '' : '(et Pays si nécessaire)'}</label>
                            <textarea
                                {...form.register('ent_adresse')}
                                rows={2}
                                className={cn(
                                    "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border",
                                    form.formState.errors.ent_adresse && "border-red-500 focus:border-red-500 focus:ring-red-500"
                                )}
                            />
                            {form.watch('ent_adresse') && (
                                <div className="mt-4 rounded-md overflow-hidden border border-gray-200 shadow-sm">
                                    <iframe
                                        width="100%"
                                        height="250"
                                        loading="lazy"
                                        allowFullScreen
                                        src={`https://maps.google.com/maps?q=${encodeURIComponent(form.watch('ent_adresse'))}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                                    ></iframe>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Code Postal / Zip Code</label>
                            <input
                                {...form.register('ent_code_postal')}
                                className={cn(
                                    "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border",
                                    form.formState.errors.ent_code_postal && "border-red-500 focus:border-red-500 focus:ring-red-500"
                                )}
                            />
                            {form.formState.errors.ent_code_postal && <p className="text-red-500 text-xs mt-1">{form.formState.errors.ent_code_postal.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Ville</label>
                            <input
                                {...form.register('ent_ville')}
                                className={cn(
                                    "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border",
                                    form.formState.errors.ent_ville && "border-red-500 focus:border-red-500 focus:ring-red-500"
                                )}
                            />
                            {form.formState.errors.ent_ville && <p className="text-red-500 text-xs mt-1">{form.formState.errors.ent_ville.message}</p>}
                        </div>

                        <div className="md:col-span-2 border-t pt-4 mt-2">
                            <h3 className="text-sm font-semibold text-gray-900 mb-4">Représentant Légal (Signataire) de l'organisme d'accueil</h3>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Nom & Prénom</label>
                            <input
                                {...form.register('ent_rep_nom')}
                                className={cn(
                                    "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border",
                                    form.formState.errors.ent_rep_nom && "border-red-500 focus:border-red-500 focus:ring-red-500"
                                )}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Fonction</label>
                            <input
                                {...form.register('ent_rep_fonction')}
                                placeholder="Ex: Gérant"
                                className={cn(
                                    "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border",
                                    form.formState.errors.ent_rep_fonction && "border-red-500 focus:border-red-500 focus:ring-red-500"
                                )}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Email (pour signature)</label>
                            <input
                                {...form.register('ent_rep_email')}
                                type="email"
                                className={cn(
                                    "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border",
                                    form.formState.errors.ent_rep_email && "border-red-500 focus:border-red-500 focus:ring-red-500"
                                )}
                            />
                        </div>

                        <div className="md:col-span-2 border-t pt-4 mt-2">
                            <h3 className="text-sm font-semibold text-gray-900 mb-4">Tuteur de Stage</h3>
                            <div className="mb-4 flex items-center">
                                <input
                                    type="checkbox"
                                    {...form.register('tuteur_meme_personne')}
                                    id="sameAsHead"
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label htmlFor="sameAsHead" className="ml-2 block text-sm text-gray-900">
                                    Le tuteur est aussi le représentant légal de l'entreprise ou de l'institution d'accueil
                                </label>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Nom & Prénom</label>
                            <input
                                {...form.register('tuteur_nom')}
                                className={cn(
                                    "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border",
                                    form.formState.errors.tuteur_nom && "border-red-500 focus:border-red-500 focus:ring-red-500"
                                )}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Fonction</label>
                            <input
                                {...form.register('tuteur_fonction')}
                                className={cn(
                                    "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border",
                                    form.formState.errors.tuteur_fonction && "border-red-500 focus:border-red-500 focus:ring-red-500"
                                )}
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Email Tuteur</label>
                            <input
                                {...form.register('tuteur_email')}
                                type="email"
                                className={cn(
                                    "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border",
                                    form.formState.errors.tuteur_email && "border-red-500 focus:border-red-500 focus:ring-red-500"
                                )}
                            />
                        </div>

                        <div className="md:col-span-2 border-t pt-4 mt-2">
                            <h3 className="text-sm font-semibold text-gray-900 mb-4">Avantages & Gratification (Annexe Financière)</h3>
                            <p className="text-xs text-gray-500 mb-4">Renseignez ici les avantages en nature et l'éventuelle gratification offerts au stagiaire.</p>

                            <div className="space-y-3 mb-4">
                                <span className="block text-sm font-medium text-gray-700">Participation aux frais</span>
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        {...form.register('frais_restauration')}
                                        id="frais_restauration"
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                    <label htmlFor="frais_restauration" className="ml-2 block text-sm text-gray-900">
                                        Frais de restauration
                                    </label>
                                </div>
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        {...form.register('frais_transport')}
                                        id="frais_transport"
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                    <label htmlFor="frais_transport" className="ml-2 block text-sm text-gray-900">
                                        Frais de transport
                                    </label>
                                </div>
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        {...form.register('frais_hebergement')}
                                        id="frais_hebergement"
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                    <label htmlFor="frais_hebergement" className="ml-2 block text-sm text-gray-900">
                                        Frais d'hébergement
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Gratification (Optionnel)</label>
                                <div className="mt-1 relative rounded-md shadow-sm max-w-xs">
                                    <input
                                        {...form.register('gratification_montant')}
                                        type="text"
                                        placeholder="0"
                                        className={cn(
                                            "block w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border pr-16",
                                            form.formState.errors.gratification_montant && "border-red-500 focus:border-red-500 focus:ring-red-500"
                                        )}
                                    />
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                        <span className="text-gray-500 sm:text-sm">€ / mois</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                );
            }}
        </StepWrapper>
    );
}
