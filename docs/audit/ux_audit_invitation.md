# Audit UX - Parcours d'Invitation Collaborateur

Cet audit analyse l'expérience d'un nouveau collaborateur, de la réception de son invitation à sa première connexion sur la plateforme Pledgeum.

## 1. Log du Parcours Actuel (Le "7-Clics")

| Étape | Acteur | Action | Ressenti / Friction |
| :--- | :--- | :--- | :--- |
| **1** | Admin | Ajoute le collab via le panel | Succès technique, mais compte créé "actif" sans mot de passe. |
| **2** | Collab | Reçoit l'Email n°1 (Invitation) | Message de bienvenue, mais lien libellé `/forgot-password`. |
| **3** | Collab | Clique sur le lien Email n°1 | Arrive sur "Mot de passe oublié". **Doute** : "Je n'ai rien oublié". |
| **4** | Collab | Clique sur "Envoyer" | Doit retourner dans sa boîte mail. **Friction** : Sortie de plateforme. |
| **5** | Collab | Reçoit l'Email n°2 (Réinitialisation) | Reçoit enfin le vrai lien technique de création. |
| **6** | Collab | Définit son mot de passe | Succès, mais est redirigé vers `/login` après 3 secondes. |
| **7** | Collab | Se reconnecte manuellement | Doit ressaisir Email + Password. **Friction** : Redondance. |

## 2. Rapport d'Étonnement (Points Critiques)

> [!WARNING]
> **La Sémantique "Oubli"** : Utiliser le flux `forgot-password` pour une **création** de compte est anxiogène et illogique pour l'utilisateur.
>
> **Le Double Email** : L'utilisateur est sollicité deux fois par email pour une seule action. C'est le point de décrochage n°1 (risque de passage en spam, lassitude).
>
> **L'Absence d'Auto-Login** : Une fois le mot de passe défini, l'identité est prouvée. Forcer une reconnexion manuelle est une barrière inutile en 2026.

## 3. Préconisations UX (Le Flux "Premium")

### Vision : Le Parcours en 4 Étapes
1. **Admin** invite -> **1 seul Email** envoyé.
2. **Collab** clique sur un lien sécurisé (avec token).
3. **Collab** définit son mot de passe sur une page dédiée ("Finaliser mon compte").
4. **Système** connecte l'utilisateur instantanément et affiche le Dashboard.

### Recommandations Techniques
- **Token d'Activation** : Générer un token `verification_token` dès l'invitation pour permettre un accès direct à la page de création.
- **NextAuth Auto-Login** : Utiliser la méthode `signIn` de Next-Auth côté client immédiatement après le succès du changement de mot de passe.
- **Harmonisation Sémantique** : Créer une page `/auth/activate` ou personnaliser `/auth/reset-password` pour afficher "Bienvenue ! Choisissez votre mot de passe" au lieu de "Réinitialisation".
