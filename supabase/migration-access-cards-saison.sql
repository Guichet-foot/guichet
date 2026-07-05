-- Add saison column to access_cards table
ALTER TABLE access_cards ADD COLUMN IF NOT EXISTS saison text;
