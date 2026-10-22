-- Migration : comptage des billets par pass en un seul aller-retour
-- À exécuter dans l'éditeur SQL de Supabase
--
-- Contexte : signalement de lenteurs générales sur la plateforme. getBilleterieList()
-- (page Billetterie, vue fondateur/admin) lançait N requêtes COUNT(*) séparées en
-- parallèle — une par pass — sur billeterie_tickets (427 000+ lignes). Pour le
-- fondateur, qui voit tous les pass, c'est 179 requêtes simultanées envoyées à
-- chaque chargement de la page, sur un compute Supabase NANO déjà signalé comme
-- sujet à saturation du pool de connexions (voir migration-perf-indexes.sql).
--
-- Remplacé par une seule requête groupée côté base de données.

CREATE OR REPLACE FUNCTION get_billeterie_ticket_counts(bil_ids uuid[])
RETURNS TABLE(billeterie_id uuid, ticket_count bigint)
LANGUAGE sql
STABLE
AS $$
  SELECT billeterie_id, COUNT(*) AS ticket_count
  FROM billeterie_tickets
  WHERE billeterie_id = ANY(bil_ids)
    AND withdrawn = false
  GROUP BY billeterie_id;
$$;
