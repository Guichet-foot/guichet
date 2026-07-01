-- Migration : Paiements journaliers par zone (activation Paytech)
-- À exécuter dans l'éditeur SQL de Supabase

CREATE TABLE IF NOT EXISTS zone_daily_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id uuid NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  ref_command text NOT NULL UNIQUE,
  amount integer NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'success', 'failed')),
  payment_method text,
  paid_at timestamptz,
  valid_until timestamptz,
  paytech_token text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_zone_payments_zone_valid
  ON zone_daily_payments(zone_id, valid_until);

ALTER TABLE zone_daily_payments ENABLE ROW LEVEL SECURITY;

-- Les membres d'une zone peuvent lire leurs propres paiements
DROP POLICY IF EXISTS "zone members read own payments" ON zone_daily_payments;
CREATE POLICY "zone members read own payments" ON zone_daily_payments
  FOR SELECT TO authenticated
  USING (
    zone_id = (SELECT zone_id FROM profiles WHERE id = auth.uid())
    OR get_user_role() IN ('super_admin', 'fondateur')
  );

-- Seul l'admin_zone peut créer un paiement pour sa propre zone
DROP POLICY IF EXISTS "admin_zone creates zone payment" ON zone_daily_payments;
CREATE POLICY "admin_zone creates zone payment" ON zone_daily_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    zone_id = (SELECT zone_id FROM profiles WHERE id = auth.uid())
    AND get_user_role() = 'admin_zone'
  );
