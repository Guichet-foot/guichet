-- Migration : Suppression automatique des billets après 24h (via pg_cron)
-- Prérequis : activer pg_cron dans Supabase → Database → Extensions → pg_cron

-- Fonction de nettoyage
CREATE OR REPLACE FUNCTION cleanup_old_tickets()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM tickets
  WHERE sold_at < NOW() - INTERVAL '24 hours';
END;
$$;

-- Planification : tous les jours à 3h du matin (heure UTC)
-- Commenter/décommenter selon si pg_cron est activé
SELECT cron.schedule(
  'cleanup-old-tickets',
  '0 3 * * *',
  'SELECT cleanup_old_tickets()'
);

-- Pour vérifier les jobs planifiés :
-- SELECT * FROM cron.job;

-- Pour supprimer le job si besoin :
-- SELECT cron.unschedule('cleanup-old-tickets');
