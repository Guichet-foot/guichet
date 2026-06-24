-- =========================
-- TABLES
-- =========================

-- ZONES
create table zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region text,
  created_at timestamptz default now()
);

-- PROFILES (étend auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  role text not null check (role in ('super_admin', 'admin_zone', 'caissier')),
  zone_id uuid references zones(id),
  active boolean default true,
  created_at timestamptz default now()
);

-- MATCHES
create table matches (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references zones(id),
  home_team text not null,
  away_team text not null,
  venue text not null,
  match_date timestamptz not null,
  status text not null default 'programme'
    check (status in ('programme', 'en_cours', 'termine', 'annule')),
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- TICKET CATEGORIES (par match)
create table ticket_categories (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  name text not null,
  price integer not null,
  quantity_total integer not null default 0,
  display_order integer default 0,
  active boolean default true,
  created_at timestamptz default now()
);

-- TICKETS (chaque billet vendu)
create table tickets (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id),
  category_id uuid not null references ticket_categories(id),
  qr_token uuid unique not null default gen_random_uuid(),
  serial_number text unique not null,
  price integer not null,
  status text not null default 'vendu'
    check (status in ('vendu', 'scanne', 'annule')),
  sold_by uuid not null references profiles(id),
  sold_at timestamptz default now(),
  scanned_at timestamptz,
  scanned_by uuid references profiles(id)
);

-- EXPENSES (dépenses)
create table expenses (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references zones(id),
  match_id uuid references matches(id),
  label text not null,
  category text
    check (category in ('organisation', 'arbitrage', 'securite', 'materiel', 'transport', 'autre')),
  amount integer not null,
  expense_date date not null default current_date,
  added_by uuid not null references profiles(id),
  notes text,
  created_at timestamptz default now()
);

-- AUDIT LOG (traçabilité)
create table audit_log (
  id bigserial primary key,
  user_id uuid references profiles(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz default now()
);

-- =========================
-- INDEX
-- =========================
create index idx_tickets_match on tickets(match_id);
create index idx_tickets_sold_by on tickets(sold_by);
create index idx_tickets_qr on tickets(qr_token);
create index idx_tickets_status on tickets(status);
create index idx_matches_zone on matches(zone_id);
create index idx_matches_date on matches(match_date);
create index idx_expenses_match on expenses(match_id);
create index idx_expenses_zone on expenses(zone_id);
create index idx_profiles_zone on profiles(zone_id);

-- =========================
-- RLS
-- =========================

alter table zones enable row level security;
alter table profiles enable row level security;
alter table matches enable row level security;
alter table ticket_categories enable row level security;
alter table tickets enable row level security;
alter table expenses enable row level security;
alter table audit_log enable row level security;

-- Helpers
create or replace function get_user_role()
returns text language sql security definer stable as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function get_user_zone()
returns uuid language sql security definer stable as $$
  select zone_id from profiles where id = auth.uid();
$$;

-- ZONES
create policy "super_admin manages zones" on zones for all
  using (get_user_role() = 'super_admin');
create policy "users read their zone" on zones for select
  using (id = get_user_zone() or get_user_role() = 'super_admin');

-- PROFILES
create policy "super_admin manages all profiles" on profiles for all
  using (get_user_role() = 'super_admin');
create policy "users read own profile" on profiles for select
  using (id = auth.uid());
create policy "admin_zone reads profiles in zone" on profiles for select
  using (zone_id = get_user_zone() and get_user_role() = 'admin_zone');

-- MATCHES
create policy "admin manages matches in zone" on matches for all
  using (
    (zone_id = get_user_zone() and get_user_role() = 'admin_zone')
    or get_user_role() = 'super_admin'
  );
create policy "caissier reads matches in zone" on matches for select
  using (zone_id = get_user_zone());

-- TICKET_CATEGORIES
create policy "admin manages categories" on ticket_categories for all
  using (
    exists (
      select 1 from matches m where m.id = match_id
      and ((m.zone_id = get_user_zone() and get_user_role() = 'admin_zone')
           or get_user_role() = 'super_admin')
    )
  );
create policy "caissier reads categories" on ticket_categories for select
  using (
    exists (select 1 from matches m where m.id = match_id and m.zone_id = get_user_zone())
  );

-- TICKETS
create policy "caissier creates tickets" on tickets for insert with check (
  sold_by = auth.uid()
  and exists (select 1 from matches m where m.id = match_id and m.zone_id = get_user_zone())
);
create policy "caissier reads own tickets" on tickets for select
  using (sold_by = auth.uid());
create policy "admin reads tickets in zone" on tickets for select
  using (
    exists (select 1 from matches m where m.id = match_id
      and (m.zone_id = get_user_zone() or get_user_role() = 'super_admin'))
    and get_user_role() in ('admin_zone', 'super_admin')
  );
create policy "any user updates ticket scan in zone" on tickets for update
  using (
    exists (select 1 from matches m where m.id = match_id and m.zone_id = get_user_zone())
  );

-- EXPENSES
create policy "admin manages expenses in zone" on expenses for all
  using (
    (zone_id = get_user_zone() and get_user_role() = 'admin_zone')
    or get_user_role() = 'super_admin'
  );

-- AUDIT
create policy "all users insert audit" on audit_log for insert with check (user_id = auth.uid());
create policy "admin reads audit" on audit_log for select
  using (get_user_role() in ('admin_zone', 'super_admin'));
