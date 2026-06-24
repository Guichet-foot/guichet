-- Migration : ajouter la table teams
-- À exécuter dans l'éditeur SQL de Supabase

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references zones(id),
  name text not null,
  president text,
  delegates text[] default '{}',
  colors text,
  created_at timestamptz default now()
);

create index if not exists idx_teams_zone on teams(zone_id);

alter table teams enable row level security;

create policy "admin manages teams in zone" on teams for all
  using (
    (zone_id = get_user_zone() and get_user_role() = 'admin_zone')
    or get_user_role() = 'super_admin'
  );

create policy "users read teams in zone" on teams for select
  using (zone_id = get_user_zone());
