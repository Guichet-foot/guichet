-- Migration : module Programme / Tournoi
-- À exécuter dans l'éditeur SQL de Supabase

-- TOURNAMENTS (saison/tournoi)
create table if not exists tournaments (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references zones(id),
  name text not null,
  season text not null,
  status text not null default 'en_cours'
    check (status in ('en_cours', 'termine')),
  created_at timestamptz default now()
);

-- TOURNAMENT GROUPS (poules)
create table if not exists tournament_groups (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  name text not null,
  display_order integer default 0,
  created_at timestamptz default now()
);

-- TOURNAMENT GROUP TEAMS (équipes par poule)
create table if not exists tournament_group_teams (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references tournament_groups(id) on delete cascade,
  team_id uuid not null references teams(id),
  created_at timestamptz default now(),
  unique(group_id, team_id)
);

-- TOURNAMENT MATCHES (matchs du tournoi avec résultats)
create table if not exists tournament_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  group_id uuid not null references tournament_groups(id) on delete cascade,
  home_team_id uuid not null references teams(id),
  away_team_id uuid not null references teams(id),
  match_date timestamptz,
  venue text,
  home_score integer,
  away_score integer,
  journee integer default 1,
  status text not null default 'programme'
    check (status in ('programme', 'termine', 'annule')),
  match_id uuid references matches(id),
  created_at timestamptz default now()
);

-- INDEX
create index if not exists idx_tournaments_zone on tournaments(zone_id);
create index if not exists idx_tournament_groups_tournament on tournament_groups(tournament_id);
create index if not exists idx_tournament_group_teams_group on tournament_group_teams(group_id);
create index if not exists idx_tournament_matches_tournament on tournament_matches(tournament_id);
create index if not exists idx_tournament_matches_group on tournament_matches(group_id);

-- RLS
alter table tournaments enable row level security;
alter table tournament_groups enable row level security;
alter table tournament_group_teams enable row level security;
alter table tournament_matches enable row level security;

-- POLICIES
create policy "admin manages tournaments" on tournaments for all
  using (
    (zone_id = get_user_zone() and get_user_role() = 'admin_zone')
    or get_user_role() = 'super_admin'
  );
create policy "users read tournaments in zone" on tournaments for select
  using (zone_id = get_user_zone());

create policy "admin manages tournament_groups" on tournament_groups for all
  using (
    exists (
      select 1 from tournaments t where t.id = tournament_id
      and ((t.zone_id = get_user_zone() and get_user_role() = 'admin_zone')
           or get_user_role() = 'super_admin')
    )
  );
create policy "users read tournament_groups" on tournament_groups for select
  using (
    exists (select 1 from tournaments t where t.id = tournament_id and t.zone_id = get_user_zone())
  );

create policy "admin manages group_teams" on tournament_group_teams for all
  using (
    exists (
      select 1 from tournament_groups g
      join tournaments t on t.id = g.tournament_id
      where g.id = group_id
      and ((t.zone_id = get_user_zone() and get_user_role() = 'admin_zone')
           or get_user_role() = 'super_admin')
    )
  );
create policy "users read group_teams" on tournament_group_teams for select
  using (
    exists (
      select 1 from tournament_groups g
      join tournaments t on t.id = g.tournament_id
      where g.id = group_id and t.zone_id = get_user_zone()
    )
  );

create policy "admin manages tournament_matches" on tournament_matches for all
  using (
    exists (
      select 1 from tournaments t where t.id = tournament_id
      and ((t.zone_id = get_user_zone() and get_user_role() = 'admin_zone')
           or get_user_role() = 'super_admin')
    )
  );
create policy "users read tournament_matches" on tournament_matches for select
  using (
    exists (select 1 from tournaments t where t.id = tournament_id and t.zone_id = get_user_zone())
  );
