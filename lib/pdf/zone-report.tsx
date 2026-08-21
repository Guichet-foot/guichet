import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

function fmt(n: number) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " FCFA";
}
function fmtN(n: number) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export interface ZoneReportMatch {
  label: string;
  date: string;
  scanned: number;
  revenue: number;
}

export interface ZoneReportData {
  organisateurName: string;
  organisateurType: "zone" | "c3";
  periodLabel: string;
  generatedAt: string;
  odcavRate: number;
  totalScanned: number;
  totalRevenue: number;
  odcavCommission: number;
  fraisPlateformePeriod: number;
  recetteNette: number;
  matches: ZoneReportMatch[];
}

const GREEN = "#0D5C3F";
const GREEN_LIGHT = "#E8F5EF";

const s = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 9,
    fontFamily: "Helvetica",
    backgroundColor: "#FAFAF9",
  },

  // ── Header ──────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 22,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: GREEN,
  },
  brand: {
    fontSize: 7,
    color: "#9CA3AF",
    letterSpacing: 2,
    marginBottom: 5,
    fontFamily: "Helvetica-Bold",
  },
  orgName: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: GREEN,
  },
  orgSubtitle: {
    fontSize: 9,
    color: "#374151",
    marginTop: 3,
  },
  period: {
    fontSize: 8,
    color: "#6B7280",
    marginTop: 3,
  },
  badgeWrap: {
    alignItems: "flex-end",
  },
  badge: {
    backgroundColor: GREEN,
    borderRadius: 3,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  generatedAt: {
    fontSize: 7,
    color: "#9CA3AF",
    marginTop: 7,
  },

  // ── Summary cards ────────────────────────────────────────────────
  cardsRow: {
    flexDirection: "row",
    gap: 7,
    marginBottom: 22,
  },
  card: {
    flex: 1,
    borderRadius: 6,
    padding: 11,
  },
  cardLabel: {
    fontSize: 7,
    color: "#6B7280",
    marginBottom: 7,
    textTransform: "uppercase",
  },
  cardValue: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
  },
  cardSub: {
    fontSize: 7,
    color: "#9CA3AF",
    marginTop: 5,
  },

  // ── Section title ────────────────────────────────────────────────
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: GREEN,
    marginBottom: 7,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#D1FAE5",
  },

  // ── Table ────────────────────────────────────────────────────────
  thRow: {
    flexDirection: "row",
    backgroundColor: GREEN,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 3,
    marginBottom: 1,
  },
  thText: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
  },
  tRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  tRowAlt: {
    backgroundColor: "#F6F7F5",
  },
  tCell: {
    fontSize: 8,
  },
  totRow: {
    flexDirection: "row",
    backgroundColor: GREEN,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 3,
    marginTop: 2,
  },
  totCell: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
  },

  // ── Footer ───────────────────────────────────────────────────────
  footer: {
    position: "absolute",
    bottom: 20,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 6,
  },
  footerText: {
    fontSize: 7,
    color: "#9CA3AF",
  },
});

export function ZoneReport({ data }: { data: ZoneReportData }) {
  const odcavPct = (data.odcavRate * 100).toFixed(0);
  const typeLabel = data.organisateurType === "c3" ? "C3 — Billeterie" : "Zone";

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.brand}>GUICHET FOOT</Text>
            <Text style={s.orgName}>{data.organisateurName}</Text>
            <Text style={s.orgSubtitle}>Rapport Financier · {typeLabel}</Text>
            <Text style={s.period}>{data.periodLabel}</Text>
          </View>
          <View style={s.badgeWrap}>
            <View style={s.badge}>
              <Text style={s.badgeText}>RAPPORT OFFICIEL</Text>
            </View>
            <Text style={s.generatedAt}>Généré le {data.generatedAt}</Text>
          </View>
        </View>

        {/* Summary cards */}
        <View style={s.cardsRow}>
          <View style={[s.card, { backgroundColor: GREEN_LIGHT }]}>
            <Text style={s.cardLabel}>Recettes Brutes</Text>
            <Text style={[s.cardValue, { color: GREEN }]}>{fmt(data.totalRevenue)}</Text>
            <Text style={s.cardSub}>{fmtN(data.totalScanned)} billets validés</Text>
          </View>
          <View style={[s.card, { backgroundColor: "#EFF6FF" }]}>
            <Text style={s.cardLabel}>Commission ODCAV ({odcavPct}%)</Text>
            <Text style={[s.cardValue, { color: "#1D4ED8" }]}>{fmt(data.odcavCommission)}</Text>
            <Text style={s.cardSub}>À reverser à l&apos;ODCAV</Text>
          </View>
          <View style={[s.card, { backgroundColor: "#FFF7ED" }]}>
            <Text style={s.cardLabel}>Frais Billetterie</Text>
            <Text style={[s.cardValue, { color: "#C2410C" }]}>{fmt(data.fraisPlateformePeriod)}</Text>
            <Text style={s.cardSub}>{fmtN(data.totalScanned)} × 10 FCFA</Text>
          </View>
          <View style={[s.card, { backgroundColor: data.recetteNette >= 0 ? "#F0FDF4" : "#FEF2F2" }]}>
            <Text style={s.cardLabel}>Recette Nette</Text>
            <Text style={[s.cardValue, { color: data.recetteNette >= 0 ? "#16A34A" : "#DC2626" }]}>
              {fmt(data.recetteNette)}
            </Text>
            <Text style={s.cardSub}>Brutes − ODCAV − Frais</Text>
          </View>
        </View>

        {/* Matches table */}
        {data.matches.length > 0 && (
          <View>
            <Text style={s.sectionTitle}>
              Détail des matchs — {data.matches.length} match{data.matches.length > 1 ? "s" : ""}
            </Text>

            <View style={s.thRow}>
              <Text style={[s.thText, { flex: 3 }]}>Match</Text>
              <Text style={[s.thText, { flex: 1.4 }]}>Date</Text>
              <Text style={[s.thText, { flex: 1, textAlign: "right" }]}>Scannés</Text>
              <Text style={[s.thText, { flex: 2, textAlign: "right" }]}>Recettes brutes</Text>
            </View>

            {data.matches.map((m, i) => (
              <View key={i} style={[s.tRow, i % 2 === 1 ? s.tRowAlt : {}]}>
                <Text style={[s.tCell, { flex: 3, fontFamily: "Helvetica-Bold" }]}>{m.label}</Text>
                <Text style={[s.tCell, { flex: 1.4, color: "#6B7280" }]}>{m.date}</Text>
                <Text style={[s.tCell, { flex: 1, textAlign: "right" }]}>
                  {fmtN(m.scanned)}
                </Text>
                <Text style={[s.tCell, { flex: 2, textAlign: "right", fontFamily: "Helvetica-Bold", color: GREEN }]}>
                  {fmt(m.revenue)}
                </Text>
              </View>
            ))}

            <View style={s.totRow}>
              <Text style={[s.totCell, { flex: 3 }]}>TOTAL</Text>
              <Text style={[s.totCell, { flex: 1.4 }]}>
                {data.matches.length} match{data.matches.length > 1 ? "s" : ""}
              </Text>
              <Text style={[s.totCell, { flex: 1, textAlign: "right" }]}>
                {fmtN(data.totalScanned)}
              </Text>
              <Text style={[s.totCell, { flex: 2, textAlign: "right" }]}>
                {fmt(data.totalRevenue)}
              </Text>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Guichet Foot · {data.organisateurName}</Text>
          <Text style={s.footerText}>{data.periodLabel}</Text>
          <Text style={s.footerText}>Généré le {data.generatedAt}</Text>
        </View>
      </Page>
    </Document>
  );
}
