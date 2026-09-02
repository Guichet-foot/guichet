-- Migration : Frais billetterie basés sur les blocs commandés (plutôt que sur les billets scannés)
-- À exécuter dans l'éditeur SQL de Supabase

ALTER TABLE billeterie
  ADD COLUMN IF NOT EXISTS blocks_ordered integer,
  ADD COLUMN IF NOT EXISTS block_order_date date;
