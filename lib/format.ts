import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export function formatFCFA(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .format(amount)
    .replace(/\s/g, " ")
    .concat(" FCFA");
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), "dd/MM/yyyy", { locale: fr });
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), "dd/MM/yyyy HH:mm", { locale: fr });
}

export function formatDateLong(date: string | Date): string {
  return format(new Date(date), "EEEE d MMMM yyyy", { locale: fr });
}

export function formatDateShort(date: string | Date): string {
  return format(new Date(date), "EEE d MMM yyyy — HH'h'mm", { locale: fr });
}

export function formatTime(date: string | Date): string {
  return format(new Date(date), "HH'h'mm", { locale: fr });
}

export function formatRelative(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: fr });
}

export function generateSerialNumber(date: Date, count: number): string {
  const dateStr = format(date, "yyyyMMdd");
  const num = String(count).padStart(4, "0");
  return `GF-${dateStr}-${num}`;
}

// "Zone 5A" → "ZONE5A"  |  "ZONE 2B" → "ZONE2B"
export function fmtZone(zone: string): string {
  return zone.replace(/\s+/g, "").toUpperCase();
}
