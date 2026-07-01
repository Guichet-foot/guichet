-- Migration : Vente de billets par lot (multi-billets)
-- À exécuter dans l'éditeur SQL de Supabase

-- Identifiant de lot : tous les billets d'une même vente groupée partagent le même sale_batch_id
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sale_batch_id uuid;

-- Index pour requêtes par lot
CREATE INDEX IF NOT EXISTS tickets_sale_batch_id_idx ON tickets(sale_batch_id);
