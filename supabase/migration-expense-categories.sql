-- Migration : supprimer la contrainte CHECK sur expenses.category
-- pour permettre des catégories personnalisées
-- À exécuter dans l'éditeur SQL de Supabase

ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_category_check;
