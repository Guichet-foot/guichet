-- Durée d'expiration du mot de passe (en minutes, null = jamais)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS password_duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS password_expires_at TIMESTAMPTZ;
