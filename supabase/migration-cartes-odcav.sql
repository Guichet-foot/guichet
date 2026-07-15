-- Migration : Cartes ODCAV
-- Permet zone_id NULL pour les cartes de membres ODCAV (sans zone de rattachement)
-- et ajoute "odcav" comme type de carte valide.

-- 1. Rendre zone_id nullable
ALTER TABLE access_cards ALTER COLUMN zone_id DROP NOT NULL;

-- 2. Ajouter "odcav" à la contrainte CHECK sur card_type (si elle existe)
-- Si la colonne n'a pas de CHECK, cette ligne peut être ignorée.
-- ALTER TABLE access_cards DROP CONSTRAINT IF EXISTS access_cards_card_type_check;
-- ALTER TABLE access_cards ADD CONSTRAINT access_cards_card_type_check
--   CHECK (card_type IN ('zone', 'delegue', 'vendeur', 'spectateur', 'odcav'));
