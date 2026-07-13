import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import type { OdcavInfo } from "./financial-report";

function fmtAmt(amount: number) {
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " FCFA";
}

function fmtTime(t: string | undefined | null): string {
  if (!t) return "";
  // HH:MM:SS or HH:MM → "18h00"
  const parts = t.split(":");
  if (parts.length >= 2) return `${parts[0]}h${parts[1]}`;
  return t;
}

// Mapping catégorie → commission (style fiche de recettes)
const COMMISSION_GROUPS: { letter: string; label: string; categories: string[] }[] = [
  { letter: "A", label: "SPORTIVE", categories: ["arbitrage"] },
  { letter: "B", label: "ORGANISATION", categories: ["securite", "organisation", "location"] },
  { letter: "C", label: "MÉDICALE", categories: ["sante"] },
  { letter: "D", label: "FINANCES", categories: ["materiel", "communication"] },
  { letter: "E", label: "AUTRES", categories: ["transport", "restauration", "prime", "autre"] },
];

const s = StyleSheet.create({
  page: { padding: 30, fontSize: 9, fontFamily: "Helvetica" },

  // Header
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  titleBlock: { flex: 1 },
  mainTitle: { fontSize: 18, fontFamily: "Helvetica-Bold", textAlign: "center", marginBottom: 2 },
  odcavBlock: { alignItems: "flex-end" },
  odcavLogo: { width: 36, height: 36, objectFit: "contain", marginBottom: 3 },
  odcavName: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#1D4ED8", textAlign: "right" },
  odcavMeta: { fontSize: 7, color: "#6B7280", textAlign: "right", marginTop: 1 },

  // Location / date info
  infoLine: { fontSize: 9, textAlign: "right", marginBottom: 2 },

  // Phase label
  phaseLabel: { fontSize: 9, fontFamily: "Helvetica-Bold", marginTop: 10, marginBottom: 2 },
  venueLabel: { fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 8 },

  // Matches table
  matchTable: { borderWidth: 1, borderColor: "#000", marginBottom: 14 },
  matchHeaderRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#000", backgroundColor: "#F3F4F6" },
  matchRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#9CA3AF" },
  matchDateCell: { width: 70, padding: 5, borderRightWidth: 1, borderRightColor: "#000", fontFamily: "Helvetica-Bold", fontSize: 9 },
  matchTimeCell: { width: 45, padding: 5, borderRightWidth: 1, borderRightColor: "#9CA3AF", fontSize: 9, textAlign: "center" },
  matchTeamCell: { flex: 1, padding: 5, borderRightWidth: 1, borderRightColor: "#9CA3AF", fontSize: 9 },
  matchTeamLastCell: { flex: 1, padding: 5, fontSize: 9 },
  matchRevCell: { width: 80, padding: 5, fontSize: 9, textAlign: "right", fontFamily: "Helvetica-Bold" },

  // "RECETTES DE LA JOURNÉE" banner
  recettesBanner: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "#DC2626", padding: "6 10", marginBottom: 10,
  },
  recettesLabel: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#FFFFFF", fontStyle: "italic" },
  recettesValue: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#FFFFFF" },

  // Commission section
  commissionSection: { marginBottom: 8 },
  commissionHeaderRow: { flexDirection: "row", borderWidth: 1, borderColor: "#000", backgroundColor: "#F3F4F6" },
  commissionLetter: { width: 22, padding: 4, borderRightWidth: 1, borderRightColor: "#000", fontFamily: "Helvetica-Bold", fontSize: 9, textAlign: "center" },
  commissionLabel: { flex: 1, padding: 4, fontFamily: "Helvetica-Bold", fontSize: 9, color: "#DC2626" },

  // Expense rows
  expRow: { flexDirection: "row", borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 0.5, borderColor: "#9CA3AF" },
  expNumCell: { width: 22, padding: "3 4", borderRightWidth: 0.5, borderRightColor: "#9CA3AF", textAlign: "center", fontSize: 8 },
  expLabelCell: { flex: 1, padding: "3 6", borderRightWidth: 0.5, borderRightColor: "#9CA3AF", fontSize: 8 },
  expAmountCell: { width: 90, padding: "3 6", textAlign: "right", fontSize: 8 },

  // Sous-total row
  sousTotal: { flexDirection: "row", justifyContent: "space-between", borderWidth: 1, borderColor: "#000", padding: "4 8", backgroundColor: "#F9FAFB", marginTop: -0.5 },
  sousTotalLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", fontStyle: "italic" },
  sousTotalValue: { fontSize: 8, fontFamily: "Helvetica-Bold", fontStyle: "italic" },

  // Total dépenses
  totalDepenses: { flexDirection: "row", justifyContent: "space-between", borderWidth: 1.5, borderColor: "#000", padding: "6 10", marginTop: 4, marginBottom: 10 },
  totalDepensesLabel: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  totalDepensesValue: { fontSize: 10, fontFamily: "Helvetica-Bold" },

  // Recettes nettes
  recettesNettes: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#DC2626", padding: "6 10", marginBottom: 6 },
  recettesNettesLabel: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#FFF" },
  recettesNettesValue: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#FFF" },

  // Distribution rows
  distRow: { flexDirection: "row", justifyContent: "space-between", padding: "4 10", borderBottomWidth: 0.5, borderBottomColor: "#D1D5DB" },
  distLabel: { fontSize: 9, fontFamily: "Helvetica-Bold", fontStyle: "italic" },
  distValue: { fontSize: 9, fontFamily: "Helvetica-Bold", fontStyle: "italic" },

  // Frais plateforme row
  fraisRow: { flexDirection: "row", justifyContent: "space-between", padding: "4 10", backgroundColor: "#FFF7ED", borderWidth: 0.5, borderColor: "#FED7AA", marginTop: 6 },
  fraisLabel: { fontSize: 8, color: "#C2410C" },
  fraisValue: { fontSize: 8, color: "#C2410C", fontFamily: "Helvetica-Bold" },

  footer: {
    position: "absolute", bottom: 18, left: 30, right: 30,
    textAlign: "center", fontSize: 6.5, color: "#9CA3AF",
    borderTopWidth: 0.5, borderTopColor: "#D1D5DB", paddingTop: 5,
  },
});

export interface DailyReportData {
  zoneName: string;
  date: string;
  generatedAt: string;
  totalRevenue: number;
  totalExpenses: number;
  odcavCommission: number;
  odcavRate: number;
  fraisPlateforme: number;
  netZone: number;
  revenueByMatch: {
    homeTeam: string;
    awayTeam: string;
    matchDate?: string;
    matchTime?: string;
    sold: number;
    revenue: number;
  }[];
  expenses: { label: string; categoryKey: string; category: string; amount: number }[];
  odcavInfo?: OdcavInfo;
}

export function DailyReport({ data }: { data: DailyReportData }) {
  const odcav = data.odcavInfo;
  const hasOdcav = odcav && (odcav.nom || odcav.adresse || odcav.president);

  const recettesNettes = Math.max(0, data.totalRevenue - data.totalExpenses);
  const odcavPart = Math.round(recettesNettes * data.odcavRate);
  const zonePart = Math.max(0, recettesNettes - odcavPart);

  // Group expenses by commission
  const groups = COMMISSION_GROUPS.map((g) => {
    const items = data.expenses.filter((e) => g.categories.includes(e.categoryKey));
    const total = items.reduce((sum, e) => sum + e.amount, 0);
    return { ...g, items, total };
  }).filter((g) => g.items.length > 0);

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* En-tête */}
        <View style={s.headerRow}>
          <View style={s.titleBlock}>
            <Text style={s.mainTitle}>FICHE DE RECETTES</Text>
          </View>
          {hasOdcav && (
            <View style={s.odcavBlock}>
              {odcav.logoUrl && <Image src={odcav.logoUrl} style={s.odcavLogo} />}
              {odcav.nom && <Text style={s.odcavName}>{odcav.nom}</Text>}
              {odcav.adresse && <Text style={s.odcavMeta}>{odcav.adresse}</Text>}
              {odcav.president && <Text style={s.odcavMeta}>Président : {odcav.president}</Text>}
              {odcav.telephone && <Text style={s.odcavMeta}>Tél : {odcav.telephone}</Text>}
            </View>
          )}
        </View>

        {/* Lieu + date */}
        <Text style={s.infoLine}>{data.zoneName}, le {data.date}</Text>
        <Text style={{ fontSize: 7, color: "#6B7280", textAlign: "right", marginBottom: 10 }}>
          Généré le {data.generatedAt}
        </Text>

        {/* Matchs du jour */}
        {data.revenueByMatch.length > 0 && (
          <View style={s.matchTable}>
            {data.revenueByMatch.map((m, i) => {
              const isFirst = i === 0;
              const dateStr = m.matchDate
                ? new Date(m.matchDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
                : data.date;
              return (
                <View key={i} style={[s.matchRow, isFirst ? { borderTopWidth: 0 } : {}]}>
                  <View style={s.matchDateCell}>
                    <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9 }}>{dateStr}</Text>
                  </View>
                  <View style={s.matchTimeCell}>
                    <Text>{fmtTime(m.matchTime)}</Text>
                  </View>
                  <View style={s.matchTeamCell}>
                    <Text style={{ fontFamily: "Helvetica-Bold" }}>{m.homeTeam}</Text>
                  </View>
                  <View style={s.matchTeamLastCell}>
                    <Text style={{ fontFamily: "Helvetica-Bold" }}>{m.awayTeam}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Bannière RECETTES DE LA JOURNÉE */}
        <View style={s.recettesBanner}>
          <Text style={s.recettesLabel}>RECETTES DE LA JOURNÉE</Text>
          <Text style={s.recettesValue}>{fmtAmt(data.totalRevenue)}</Text>
        </View>

        {/* Tableau des dépenses par commission */}
        {groups.length > 0 ? (
          <>
            {/* En-tête du tableau global */}
            <View style={{ flexDirection: "row", borderWidth: 1, borderColor: "#000", backgroundColor: "#E5E7EB", marginBottom: 2 }}>
              <Text style={{ width: 22, padding: 4, borderRightWidth: 1, borderRightColor: "#000", fontFamily: "Helvetica-Bold", fontSize: 8, textAlign: "center" }}>N°</Text>
              <Text style={{ width: 22, padding: 4, borderRightWidth: 1, borderRightColor: "#000", fontFamily: "Helvetica-Bold", fontSize: 8, textAlign: "center" }}>R</Text>
              <Text style={{ flex: 1, padding: 4, borderRightWidth: 1, borderRightColor: "#000", fontFamily: "Helvetica-Bold", fontSize: 8 }}>DÉSIGNATIONS</Text>
              <Text style={{ width: 90, padding: 4, fontFamily: "Helvetica-Bold", fontSize: 8, textAlign: "right" }}>MONTANT</Text>
            </View>

            {groups.map((group) => (
              <View key={group.letter} style={s.commissionSection}>
                {/* En-tête commission */}
                <View style={s.commissionHeaderRow}>
                  <Text style={s.commissionLetter}>{group.letter}</Text>
                  <Text style={s.commissionLabel}>{group.label}</Text>
                  <Text style={{ width: 90, padding: 4, fontSize: 9 }} />
                </View>

                {/* Lignes de dépenses */}
                {group.items.map((item, idx) => (
                  <View key={idx} style={s.expRow}>
                    <Text style={s.expNumCell}>{idx + 1}</Text>
                    <Text style={s.expLabelCell}>{item.label}</Text>
                    <Text style={s.expAmountCell}>{fmtAmt(item.amount)}</Text>
                  </View>
                ))}

                {/* Sous-total */}
                <View style={s.sousTotal}>
                  <Text style={s.sousTotalLabel}>SOUS TOTAL COMMISSION {group.label}</Text>
                  <Text style={s.sousTotalValue}>{fmtAmt(group.total)}</Text>
                </View>
              </View>
            ))}
          </>
        ) : (
          <View style={{ padding: "8 10", borderWidth: 0.5, borderColor: "#D1D5DB", marginBottom: 8 }}>
            <Text style={{ fontSize: 8, color: "#6B7280", textAlign: "center" }}>Aucune dépense enregistrée ce jour</Text>
          </View>
        )}

        {/* Total des dépenses */}
        <View style={s.totalDepenses}>
          <Text style={s.totalDepensesLabel}>TOTAL DES DÉPENSES</Text>
          <Text style={s.totalDepensesValue}>{fmtAmt(data.totalExpenses)}</Text>
        </View>

        {/* Recettes nettes */}
        <View style={s.recettesNettes}>
          <Text style={s.recettesNettesLabel}>RECETTES NETTES</Text>
          <Text style={s.recettesNettesValue}>{fmtAmt(recettesNettes)}</Text>
        </View>

        {/* Distribution */}
        <View style={{ borderWidth: 0.5, borderColor: "#D1D5DB", marginBottom: 6 }}>
          <View style={s.distRow}>
            <Text style={[s.distLabel, { color: "#1D4ED8" }]}>
              ODCAV {(data.odcavRate * 100).toFixed(0)}%
              {odcav?.nom ? `  (${odcav.nom})` : ""}
            </Text>
            <Text style={[s.distValue, { color: "#1D4ED8" }]}>{fmtAmt(odcavPart)}</Text>
          </View>
          <View style={[s.distRow, { borderBottomWidth: 0 }]}>
            <Text style={[s.distLabel, { color: "#0D5C3F" }]}>
              ZONE / ASC {(100 - data.odcavRate * 100).toFixed(0)}%
              {"  (" + data.zoneName + ")"}
            </Text>
            <Text style={[s.distValue, { color: "#0D5C3F" }]}>{fmtAmt(zonePart)}</Text>
          </View>
        </View>

        {/* Frais plateforme (ligne séparée) */}
        <View style={s.fraisRow}>
          <Text style={s.fraisLabel}>Frais de plateforme Guichet Foot (déduits des recettes brutes)</Text>
          <Text style={s.fraisValue}>- {fmtAmt(data.fraisPlateforme)}</Text>
        </View>

        <Text style={s.footer}>
          Document généré automatiquement par Guichet Foot · {data.date} · Commission ODCAV ({(data.odcavRate * 100).toFixed(0)}%) calculée sur les recettes nettes
        </Text>
      </Page>
    </Document>
  );
}
