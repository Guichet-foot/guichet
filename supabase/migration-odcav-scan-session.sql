-- Session de scan ODCAV (inter-matchs communaux/départementaux)
-- scope = 'odcav' pour les matchs ODCAV, ou zone_id pour les matchs de zone
CREATE TABLE IF NOT EXISTS scan_sessions (
  scope TEXT PRIMARY KEY,
  open_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
