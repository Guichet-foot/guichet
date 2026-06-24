export type UserRole = "super_admin" | "admin_zone" | "caissier";

export type MatchStatus = "programme" | "en_cours" | "termine" | "annule";

export type TicketStatus = "vendu" | "scanne" | "annule";

export type ExpenseCategory =
  | "organisation"
  | "arbitrage"
  | "securite"
  | "materiel"
  | "transport"
  | "autre";

export interface Zone {
  id: string;
  name: string;
  region: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  zone_id: string | null;
  active: boolean;
  created_at: string;
  email?: string;
  zone?: Zone;
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
  zone_id: string;
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
