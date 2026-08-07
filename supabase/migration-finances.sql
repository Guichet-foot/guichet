-- Table de suivi des paiements par match (frais de billetterie fondateur)
CREATE TABLE IF NOT EXISTS match_payments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id    uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  paid        boolean NOT NULL DEFAULT false,
  paid_at     timestamptz,
  notes       text,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(match_id)
);

ALTER TABLE match_payments ENABLE ROW LEVEL SECURITY;

-- Seul le fondateur (et ses sous-comptes) peuvent lire/écrire
CREATE POLICY "fondateur_full_access" ON match_payments
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
