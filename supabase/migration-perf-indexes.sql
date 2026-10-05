-- Migration : Index de performance sur les colonnes les plus filtrées
-- À exécuter dans l'éditeur SQL de Supabase
--
-- Contexte : incidents répétés de base "Unhealthy" / pool de connexions saturé
-- (Database, PostgREST, Auth) sur un compute NANO. Les pages Finances, Dashboard
-- et billetterie filtrent systématiquement tickets/billeterie_scans/billeterie_tickets
-- par match_id, scanned_at, status, billeterie_id, withdrawn — sans index dessus,
-- chaque requête fait un scan complet de table, ce qui gonfle le CPU et allonge
-- la durée de vie de chaque connexion (donc la taille effective du pool utilisé).
-- Index purement additifs : aucun changement de comportement applicatif.

-- ── tickets ──────────────────────────────────────────────────────────────────
-- Filtré par match_id (souvent IN (...)) + plage sur scanned_at dans presque
-- toutes les pages Finances/Dashboard. Index composite pour couvrir les deux
-- en un seul scan au lieu de combiner deux index scans.
CREATE INDEX IF NOT EXISTS idx_tickets_match_scanned_at
  ON tickets (match_id, scanned_at);

-- Filtré seul par match_id (listes de billets, invendus, etc.)
CREATE INDEX IF NOT EXISTS idx_tickets_match_id
  ON tickets (match_id);

-- status = 'scanne' est filtré très fréquemment, souvent combiné à match_id
CREATE INDEX IF NOT EXISTS idx_tickets_status
  ON tickets (status);

-- ── billeterie_scans ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_billeterie_scans_match_scanned_at
  ON billeterie_scans (match_id, scanned_at);

CREATE INDEX IF NOT EXISTS idx_billeterie_scans_match_id
  ON billeterie_scans (match_id);

-- Jointure scan -> ticket (lookup prix/catégorie) sur chaque calcul de recettes
CREATE INDEX IF NOT EXISTS idx_billeterie_scans_ticket_id
  ON billeterie_scans (ticket_id);

-- ── billeterie_tickets ──────────────────────────────────────────────────────
-- billeterie_id (souvent IN (...)) combiné à withdrawn = false dans presque
-- tous les comptages de billets imprimés/actifs.
CREATE INDEX IF NOT EXISTS idx_billeterie_tickets_bilid_withdrawn
  ON billeterie_tickets (billeterie_id, withdrawn);

CREATE INDEX IF NOT EXISTS idx_billeterie_tickets_sale_batch_id
  ON billeterie_tickets (sale_batch_id);

-- ── matches ─────────────────────────────────────────────────────────────────
-- Filtré par zone_id ou c3_account_id sur quasi toutes les pages scopées.
CREATE INDEX IF NOT EXISTS idx_matches_zone_id
  ON matches (zone_id);

CREATE INDEX IF NOT EXISTS idx_matches_c3_account_id
  ON matches (c3_account_id);

-- ── billeterie ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_billeterie_zone_id
  ON billeterie (zone_id);

-- Après création des index, Postgres doit remettre à jour ses statistiques
-- pour que le planificateur de requêtes les utilise immédiatement.
ANALYZE tickets;
ANALYZE billeterie_scans;
ANALYZE billeterie_tickets;
ANALYZE matches;
ANALYZE billeterie;
