-- Migration : Ajout type de carte et prix sur access_cards
-- Types : zone (gratuit), delegue (gratuit), vendeur (payant), spectateur (payant)

ALTER TABLE access_cards
  ADD COLUMN IF NOT EXISTS card_type text NOT NULL DEFAULT 'zone'
    CHECK (card_type IN ('zone', 'delegue', 'vendeur', 'spectateur'));

ALTER TABLE access_cards
  ADD COLUMN IF NOT EXISTS price integer DEFAULT NULL;
