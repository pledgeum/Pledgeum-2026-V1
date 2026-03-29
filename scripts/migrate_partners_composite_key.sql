-- Migration : Transition de la table partners vers une clé composite (school_id, siret)
-- Cette modification permet à plusieurs établissements de posséder le même partenaire indépendamment.

-- 1. Suppression de l'ancienne contrainte d'unicité sur le SIRET seul
-- Note : Le nom par défaut généré lors de la création initiale (UNIQUE) est 'partners_siret_key'.
ALTER TABLE partners DROP CONSTRAINT IF EXISTS partners_siret_key;

-- 2. Ajout de la nouvelle contrainte composite sur (school_id, siret)
-- Cela garantit que pour un établissement donné, un SIRET est unique, 
-- mais qu'un autre établissement peut avoir une ligne distincte pour le même SIRET.
ALTER TABLE partners ADD CONSTRAINT partners_school_siret_unique UNIQUE (school_id, siret);

-- 3. (Optionnel) Ajout d'un index explicite si nécessaire pour les performances de recherche
-- (Déjà existant via UNIQUE mais on peut en ajouter un spécifique si besoin d'ordre différent)
-- CREATE INDEX IF NOT EXISTS idx_partners_school_siret ON partners(school_id, siret);
