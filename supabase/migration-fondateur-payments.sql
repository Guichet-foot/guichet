-- Table de suivi des paiements Fondateur par compte × jour
-- Remplace match_payments pour le module Finances
CREATE TABLE IF NOT EXISTS fondateur_payments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_key text NOT NULL UNIQUE,  -- "{type}::{accountId}::{date}"
  paid        boolean NOT NULL DEFAULT false,
  paid_at     timestamptz,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE fondateur_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fondateur_full_access" ON fondateur_payments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
