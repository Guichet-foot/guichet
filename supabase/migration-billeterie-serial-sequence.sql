-- Migration : numérotation atomique des billets (corrige les doublons de numéro de série)
-- À exécuter dans l'éditeur SQL de Supabase
--
-- Contexte : Zone 4 a signalé des billets portant le même numéro ("déjà scannés").
-- Vérification : aucun doublon de qr_token (le scan n'est pas cassé), mais des
-- numéros de série identiques existent sur plusieurs billets physiques différents
-- (ex: "BIL-20261005-00061" imprimé 3 fois pour la même billetterie, lors de 3
-- impressions séparées à 15h44, 16h11 et 16h23). Cause : le numéro était dérivé
-- d'un simple COUNT(*) lu avant l'insertion, sans garantie d'atomicité — deux
-- impressions qui se chevauchent peuvent lire le même compteur et démarrer leur
-- numérotation au même endroit.
--
-- Correctif : une séquence Postgres (atomique par nature, zéro collision possible)
-- remplace le COUNT(*). reserve_billeterie_serials(n) réserve n numéros uniques en
-- un seul appel, sans boucle de nouvelle tentative nécessaire côté application.

CREATE SEQUENCE IF NOT EXISTS billeterie_ticket_serial_seq START 1;

CREATE OR REPLACE FUNCTION reserve_billeterie_serials(n integer)
RETURNS SETOF bigint
LANGUAGE sql
AS $$
  SELECT nextval('billeterie_ticket_serial_seq') FROM generate_series(1, n);
$$;

-- Fait démarrer la séquence au-delà du plus grand numéro déjà utilisé aujourd'hui,
-- pour que les nouveaux billets ne réutilisent pas une plage déjà imprimée.
SELECT setval(
  'billeterie_ticket_serial_seq',
  GREATEST(
    1,
    COALESCE((
      SELECT MAX(split_part(serial_number, '-', 3)::bigint)
      FROM billeterie_tickets
      WHERE serial_number ~ '^BIL-\d{8}-\d+$'
    ), 0) + 1
  ),
  false
);
