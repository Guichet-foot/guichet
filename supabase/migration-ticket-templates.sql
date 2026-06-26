-- Migration : modèles de billets par zone
-- À exécuter dans l'éditeur SQL de Supabase

CREATE TABLE IF NOT EXISTS ticket_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id uuid NOT NULL REFERENCES zones(id),
  name text NOT NULL,
  price integer NOT NULL,
  default_quantity integer NOT NULL DEFAULT 100,
  color text DEFAULT '#0D5C3F',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_templates_zone ON ticket_templates(zone_id);

ALTER TABLE ticket_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manages ticket_templates" ON ticket_templates FOR ALL
  USING (
    (zone_id = get_user_zone() AND get_user_role() = 'admin_zone')
    OR (get_user_role() = 'super_admin' AND is_user_zone_owner(zone_id))
  );

CREATE POLICY "users read ticket_templates in zone" ON ticket_templates FOR SELECT
  USING (zone_id = get_user_zone());
