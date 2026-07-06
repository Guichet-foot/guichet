-- Migration : Billets blocs ODCAV + vente caissier sans impression
-- À exécuter dans l'éditeur SQL de Supabase

-- ================================================================
-- 1. Marquer les billets imprimés en blocs par ODCAV
--    bloc_printed = true  → billet physique créé par ODCAV (blocs de 100)
--    bloc_printed = false → billet créé en caisse (impression ou vente directe)
-- ================================================================
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS bloc_printed boolean NOT NULL DEFAULT false;

-- ================================================================
-- 2. Caissier "Vendre" : traçabilité quand le caissier affecte un billet bloc
--    caissier_claimed_at IS NULL  = billet bloc non encore vendu par un caissier
--    caissier_claimed_at non NULL = billet affecté à un client, argent encaissé
-- ================================================================
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS caissier_claimed_at timestamptz;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS caissier_id uuid REFERENCES profiles(id);

-- ================================================================
-- 3. Colonne calculée automatiquement : un billet "compte" comme recette si :
--    a) billet normal (non-bloc) non annulé
--    b) billet bloc réclamé par caissier non annulé
--    c) billet bloc non réclamé mais scanné à l'entrée
-- ================================================================
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS counts_as_revenue boolean GENERATED ALWAYS AS (
  status != 'annule' AND (
    NOT bloc_printed
    OR caissier_claimed_at IS NOT NULL
    OR status = 'scanne'
  )
) STORED;

-- ================================================================
-- 4. Index pour les performances
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_tickets_revenue
  ON tickets (match_id, counts_as_revenue)
  WHERE counts_as_revenue = true;

CREATE INDEX IF NOT EXISTS idx_tickets_bloc_unclaimed
  ON tickets (category_id, bloc_printed, caissier_claimed_at)
  WHERE bloc_printed = true AND caissier_claimed_at IS NULL;
