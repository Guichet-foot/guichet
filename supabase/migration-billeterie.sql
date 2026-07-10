-- ═══════════════════════════════════════════════════════════════
-- MIGRATION : Module Billetterie Multi-Matchs
-- À exécuter dans le dashboard Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Sessions billetterie (pass multi-matchs)
CREATE TABLE IF NOT EXISTS billeterie (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  match_ids  uuid[] NOT NULL DEFAULT '{}',
  price      integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- 2. Billets individuels du pass
CREATE TABLE IF NOT EXISTS billeterie_tickets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billeterie_id uuid NOT NULL REFERENCES billeterie(id) ON DELETE CASCADE,
  qr_token      text NOT NULL UNIQUE,
  serial_number text NOT NULL,
  sale_batch_id uuid,
  status        text NOT NULL DEFAULT 'actif' CHECK (status IN ('actif', 'annule')),
  sold_by       uuid REFERENCES profiles(id),
  created_at    timestamptz DEFAULT now()
);

-- 3. Scans : 1 seul passage par (billet, match)
CREATE TABLE IF NOT EXISTS billeterie_scans (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  uuid NOT NULL REFERENCES billeterie_tickets(id) ON DELETE CASCADE,
  match_id   uuid NOT NULL,
  scanned_by uuid REFERENCES profiles(id),
  scanned_at timestamptz DEFAULT now(),
  UNIQUE(ticket_id, match_id)
);
