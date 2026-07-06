export type UserRole = "fondateur" | "president_odcav" | "super_admin" | "admin_zone" | "caissier" | "portier" | "c3";

export type MatchStatus = "programme" | "en_cours" | "termine" | "annule";

export type TicketStatus = "vendu" | "scanne" | "annule";

export type ExpenseCategory =
  | "organisation"
  | "arbitrage"
  | "securite"
  | "materiel"
  | "transport"
  | "autre";

export interface ZoneMember {
  name: string;
  poste: string;
  phone: string;
}

export interface Zone {
  id: string;
  name: string;
  region: string | null;
  created_by: string | null;
  logo: string | null;
  president: string | null;
  members: ZoneMember[];
  odcav: string | null;
  oncav: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  zone_id: string | null;
  active: boolean;
  is_president: boolean;
  created_by_admin: string | null;
  created_at: string;
  email?: string;
  zone?: Zone;
  city?: string | null;
  permitted_modules?: string[] | null;
}

export interface Team {
  id: string;
  zone_id: string;
  name: string;
  president: string | null;
  delegates: string[];
  colors: string | null;
  created_at: string;
}

export interface Match {
  id: string;
  zone_id: string | null;
  c3_account_id?: string | null;
  home_team: string;
  away_team: string;
  venue: string;
  match_date: string;
  status: MatchStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  zone?: Zone;
  ticket_categories?: TicketCategory[];
}

export interface TicketCategory {
  id: string;
  match_id: string;
  name: string;
  price: number;
  quantity_total: number;
  display_order: number;
  active: boolean;
  created_at: string;
  tickets_sold?: number;
}

export interface Ticket {
  id: string;
  match_id: string;
  category_id: string;
  qr_token: string;
  serial_number: string;
  price: number;
  status: TicketStatus;
  sold_by: string;
  sold_at: string;
  scanned_at: string | null;
  scanned_by: string | null;
  match?: Match;
  category?: TicketCategory;
  seller?: Profile;
  scanner?: Profile;
}

export interface Expense {
  id: string;
  zone_id: string;
  match_id: string | null;
  label: string;
  category: ExpenseCategory;
  amount: number;
  expense_date: string;
  added_by: string;
  notes: string | null;
  created_at: string;
  match?: Match;
  adder?: Profile;
}

export interface AuditLog {
  id: number;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface DashboardStats {
  todayRevenue: number;
  ticketsSold: number;
  upcomingMatches: number;
  monthBalance: number;
}

export interface ScanResult {
  status: "valid" | "already_scanned" | "invalid";
  message: string;
  categoryName?: string;
  scannedAt?: string;
}

export type CardType = 'zone' | 'delegue' | 'vendeur' | 'spectateur';

export interface AccessCard {
  id: string;
  qr_token: string;
  full_name: string;
  phone: string;
  zone_id: string;
  zone_name: string;
  poste: string;
  asc_name: string | null;
  saison: string | null;
  photo_url: string | null;
  card_type: CardType;
  price: number | null;
  created_by: string | null;
  created_at: string;
}

export type TournamentStatus = "en_cours" | "termine";
export type TournamentMatchStatus = "programme" | "termine" | "annule";

export interface Tournament {
  id: string;
  zone_id: string;
  name: string;
  season: string;
  status: TournamentStatus;
  created_at: string;
}

export interface TournamentGroup {
  id: string;
  tournament_id: string;
  name: string;
  display_order: number;
  created_at: string;
  teams?: { id: string; team: Team }[];
}

export interface TournamentMatch {
  id: string;
  tournament_id: string;
  group_id: string;
  home_team_id: string;
  away_team_id: string;
  match_date: string | null;
  venue: string | null;
  home_score: number | null;
  away_score: number | null;
  journee: number;
  status: TournamentMatchStatus;
  match_id: string | null;
  created_at: string;
  home_team?: Team;
  away_team?: Team;
  group?: TournamentGroup;
}

export interface Standing {
  teamId: string;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}
