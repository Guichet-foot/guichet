-- Add billeterie session tracking to zones
-- When not null and in the future, scanning is open for the zone
ALTER TABLE zones ADD COLUMN IF NOT EXISTS billeterie_open_until TIMESTAMPTZ;
