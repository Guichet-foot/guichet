-- Permet au fondateur de "retirer" des billets d'un lot sans affecter les QR codes
ALTER TABLE billeterie_tickets
  ADD COLUMN IF NOT EXISTS withdrawn BOOLEAN NOT NULL DEFAULT FALSE;
