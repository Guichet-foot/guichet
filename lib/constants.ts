export const APP_NAME = "Guichet Foot";
export const APP_TAGLINE = "Le guichet du Navétane";
export const APP_DOMAIN = "guichetfoot.com";

export const TIMEZONE = "Africa/Dakar";

export const MATCH_STATUS_LABELS: Record<string, string> = {
  programme: "Programmé",
  en_cours: "En cours",
  termine: "Terminé",
  annule: "Annulé",
};

export const MATCH_STATUS_COLORS: Record<string, string> = {
  programme: "bg-blue-100 text-blue-800",
  en_cours: "bg-green-100 text-green-800",
  termine: "bg-gray-100 text-gray-800",
  annule: "bg-red-100 text-red-800",
};

export const TICKET_STATUS_LABELS: Record<string, string> = {
  vendu: "Vendu",
  scanne: "Scanné",
  annule: "Annulé",
};

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  organisation: "Organisation",
  arbitrage: "Arbitrage",
  securite: "Sécurité",
  materiel: "Matériel",
  transport: "Transport",
  restauration: "Restauration",
  communication: "Communication",
  location: "Location",
  sante: "Santé",
  prime: "Primes & Récompenses",
  autre: "Autre",
};

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin_zone: "Admin Zone",
  caissier: "Caissier",
  portier: "Portier",
};

export const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-purple-100 text-purple-800",
  admin_zone: "bg-brand/10 text-brand",
  caissier: "bg-accent-gold/20 text-amber-800",
  portier: "bg-blue-100 text-blue-800",
};

export const CATEGORY_COLORS = [
  "bg-brand text-white",
  "bg-accent-gold text-white",
  "bg-indigo-600 text-white",
  "bg-rose-600 text-white",
  "bg-cyan-600 text-white",
  "bg-orange-600 text-white",
];
