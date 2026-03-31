# Walkthrough - Unification des Flux d'Activation

L'activation de compte est désormais plus résiliente, permettant aux collaborateurs d'utiliser leur email académique si leur identifiant provisoire rencontre un problème (cas d'inversion NOM/PRENOM).

## Changements Majeurs

### 1. API de Vérification Hybride
La route `/api/verify-invitation` a été modifiée pour accepter indifféremment un Email ou un Identifiant.
- **SQL** : `WHERE (lower(email) = lower($1) OR upper(temp_id) = upper($1))`
- **Bénéfice** : M. DUMASDELAGE peut désormais activer son compte en saisissant son email académique, contournant l'erreur sur son identifiant `FABRDUMA735`.

### 2. Frontend Flexible
Le composant de connexion a été mis à jour pour guider l'utilisateur.
- **Libellé** : "Email académique ou Identifiant provisoire".
- **Placeholder** : Exemple montrant les deux formats.
- **Robustesse** : Suppression de la conversion forcée en majuscules côté client pour préserver le format de l'email.

## Tests de Validation (Théoriques)

### Scénario Collaborateur (Réussi)
1. Saisie de l'email `f.dumasdelage@ac-normandie.fr`.
2. Saisie du code `425744`.
3. L'API trouve l'utilisateur par son email -> Activation possible.

### Scénario Élève (Non-Régression)
1. Saisie de l'identifiant `DUPOJEAN123`.
2. Saisie du code `AB12CD`.
3. L'API trouve l'utilisateur par son `temp_id` -> Activation toujours fonctionnelle.

## Conclusion
Le système est maintenant "Email-First" pour les personnels tout en restant compatible "ID-First" pour les élèves. La divergence de structure d'identifiants n'est plus un point bloquant pour l'accès à la plateforme.
