-- Migration : Ajouter la colonne allowed_zones pour les comptes C3 multi-zones
-- Un C3 peut gérer les compétitions de plusieurs zones (ex: Zone 5 et Zone B pour Nguekokh)

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS allowed_zones uuid[];
