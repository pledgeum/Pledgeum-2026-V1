import { z } from 'zod';

export const conventionSchema = z.object({
    // Configuration Type & Langue
    type: z.enum(['PFMP_STANDARD', 'STAGE_2NDE', 'ERASMUS_MOBILITY']).default('PFMP_STANDARD'),
    language: z.enum(['fr', 'en', 'es', 'de']).default('fr'),

    // Étape 1 : Établissement
    ecole_nom: z.string().min(2, "Le nom de l'établissement est requis"),
    ecole_adresse: z.string().min(5, "L'adresse est requise"),
    ecole_tel: z.string().min(10, "Numéro de téléphone invalide"),
    ecole_chef_nom: z.string().min(2, "Le nom du chef d'établissement scolaire est requis"),
    ecole_chef_email: z.string().email("Email invalide"),
    prof_nom: z.string().min(2, "Le nom de l'enseignant référent/professeur principal est requis"),
    prof_email: z.string().email("Email invalide"),
    prof_suivi_email: z.string().email("Email invalide").optional(),
    ecole_lat: z.number().optional(),
    ecole_lng: z.number().optional(),

    // Étape 2 : Élève
    eleve_nom: z.string().min(2, "Le nom est requis"),
    eleve_prenom: z.string().min(2, "Le prénom est requis"),
    eleve_date_naissance: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide"),
    eleve_adresse: z.string().min(5, "L'adresse est requise"),
    eleve_cp: z.string().min(2, "Code postal requis"), // Relaxed for International
    eleve_ville: z.string().min(2, "Ville requise"),
    eleve_tel: z.string().optional(),
    eleve_email: z.string().email("Email invalide"),
    eleve_classe: z.string().min(1, "La classe est requise"),
    diplome_intitule: z.string().min(2, "L'intitulé du diplôme est requis"),

    // Représentant Légal (Conditionnel)
    est_mineur: z.boolean().default(false),
    rep_legal_nom: z.string().optional(), // Requis si mineur (validation gérée dans le form)
    rep_legal_prenom: z.string().optional(),
    rep_legal_adresse: z.string().optional(),
    rep_legal_tel: z.string().optional(),
    rep_legal_email: z.string().email("Email invalide").optional().or(z.literal('')),

    // Étape 3 : Entreprise
    ent_nom: z.string().min(2, "La raison sociale est requise"),
    ent_pays: z.string().default('France'),
    ent_siret: z.string().optional(), // Optional for foreign, validated in UI if France
    ent_adresse: z.string().min(5, "L'adresse est requise"),
    ent_code_postal: z.string().min(2, "Code postal requis"), // Relaxed for International
    ent_ville: z.string().min(2, "Ville requise"),
    ent_rep_nom: z.string().min(2, "Le nom du signataire est requis"),
    ent_rep_fonction: z.string().min(2, "La fonction est requise"),
    ent_rep_email: z.string().email("Email invalide"),
    tuteur_meme_personne: z.boolean().optional(),
    tuteur_nom: z.string().min(2, "Le nom du tuteur est requis"),
    tuteur_prenom: z.string().optional(),
    tuteur_tel: z.string().optional(),
    tuteur_fonction: z.string().min(2, "La fonction du tuteur est requise"),
    tuteur_email: z.string().email("Email invalide"),

    // Annexe Financière
    frais_restauration: z.boolean().default(false),
    frais_transport: z.boolean().default(false),
    frais_hebergement: z.boolean().default(false),
    gratification_montant: z.string().optional(),

    // Étape 4 : Stage
    stage_date_debut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide"),
    stage_date_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide"),
    stage_duree_heures: z.number().min(1, "La durée doit être positive"),
    stage_activites: z.string().min(10, "Décrivez les activités prévues"),
    stage_lieu: z.string().optional(), // Si différent du siège
    stage_adresse_differente: z.boolean().default(false),

    stage_horaires: z.record(z.string(), z.object({
        matin_debut: z.string().optional(),
        matin_fin: z.string().optional(),
        apres_midi_debut: z.string().optional(),
        apres_midi_fin: z.string().optional(),

    })).optional(),

    signatures: z.any().optional(), // Allow passing signatures during creation
});

export type ConventionData = z.infer<typeof conventionSchema>;
