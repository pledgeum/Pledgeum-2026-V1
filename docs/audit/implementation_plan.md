# Plan d'Action - Flux d'Activation Isolé (Collaborateur)

Ce plan vise à simplifier radicalement l'onboarding des collaborateurs tout en garantissant une étanchéité totale avec le flux élèves et une résistance maximale aux filtres de phishing académiques.

## 1. Analyse d'Impact (Périmètre Collaborateur)

### Nouveaux Composants [NEW]
- **Page Frontend** : `src/app/activate/page.tsx`
  - URL neutre sémantiquement : `/activate`.
  - Interface dédiée "Finalisation de votre compte" (évite le terme "Réinitialisation").
- **Route API** : `src/app/api/auth/collaborator-activate/route.ts`
  - Gère la validation du token, la mise à jour du mot de passe et prépare l'auto-login.

### Modifications [MODIFY]
- **API Collaborators** : `src/app/api/school/collaborators/route.ts`
  - Génération d'un `activation_token` via `crypto.randomBytes(32).toString('hex')`.
  - Stockage dans `verification_tokens`.
  - Mise à jour du template d'email (Anti-Cisco).

## 2. Schéma du Flux (Direct Activation)

1. **Invitation** : L'admin invite le collaborateur. Un token unique est généré.
2. **Email unique** : Le collaborateur reçoit un mail avec un lien direct : `/activate?token=...&email=...`.
3. **Capture** : Sur `/activate`, l'utilisateur ne saisit que son nouveau mot de passe.
4. **Auto-Login** : Au clic, le système valide, active et connecte l'utilisateur instantanément (Dashboard immédiat).

## 3. Stratégie Anti-Phishing (Email Service)

### Sémantique Neutre
- **Expéditeur** : "Équipe Pledgeum <postmaster@pledgeum.fr>"
- **Objet** : `Activation de votre accès Pledgeum`
- **Corps (Extraits)** :
  - "Votre accès a été préparé..."
  - "Lien sécurisé de finalisation..."
  - AUCUN mot de passe en clair, AUCUNE mention de "Forget" ou "Reset".

## 4. Garantie de Non-Régression

> [!IMPORTANT]
> **Étanchéité Totale** :
> - Le flux élève/enseignant via `/login` ("J'ai un code provisoire") et `/api/auth/activate` reste **inchangé**.
> - Le flux de récupération de mot de passe perdu (`/forgot-password`) reste **inchangé** pour tous les utilisateurs.
> - La nouvelle logique est encapsulée dans `/activate` et `/api/auth/collaborator-activate`.

## Validation Requise
- [ ] Approbation du nouveau chemin `/activate`.
- [ ] Approbation du passage de 7 étapes (2 mails) à 4 étapes (1 mail).
