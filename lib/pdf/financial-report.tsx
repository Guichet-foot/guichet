import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: "#0D5C3F",
  },
  headerLeft: {},
  headerRight: {
    alignItems: "flex-end",
    maxWidth: 200,
  },
  title: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: "#0D5C3F",
  },
  zoneName: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginTop: 2,
  },
  headerMeta: {
    fontSize: 8,
    color: "#6B7280",
    marginTop: 2,
  },
  odcavBlock: {
    alignItems: "flex-end",
  },
  odcavLogo: {
    width: 40,
    height: 40,
    objectFit: "contain",
    marginBottom: 4,
  },
  odcavName: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#1D4ED8",
    textAlign: "right",
  },
  odcavMeta: {
    fontSize: 7,
    color: "#6B7280",
    textAlign: "right",
    marginTop: 1,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#0D5C3F",
    marginBottom: 8,
    marginTop: 15,
  },
  summaryCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
    gap: 8,
  },
  summaryItem: {
    flex: 1,
    padding: 10,
    backgroundColor: "#F0EDE8",
    borderRadius: 4,
  },
  summaryLabel: {
    fontSize: 8,
    color: "#6B7280",
    marginBottom: 3,
  },
  summaryValue: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E2DD",
    paddingVertical: 5,
  },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 2,
    borderBottomColor: "#0D5C3F",
    paddingVertical: 5,
    backgroundColor: "#F0EDE8",
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 30,
    right: 30,
    textAlign: "center",
    fontSize: 7,
    color: "#6B7280",
  },
});

function formatAmount(amount: number) {
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " FCFA";
}

export interface OdcavInfo {
  logoUrl?: string;
  nom?: string;
  adresse?: string;
  president?: string;
  telephone?: string;
  email?: string;
}

interface ReportData {
  zoneName: string;
  startDate: string;
  endDate: string;
  reportType: string;
  generatedAt: string;
  totalRevenue: number;
  totalExpenses: number;
  odcavRate?: number;
  odcavCommission?: number;
  fraisPlateforme?: number;
  netZone?: number;
  revenueByMatch: {
    teams: string;
    date: string;
    printed: number;
    unsold: number;
    validated: number;
    revenue: number;
    matchExpenses: number;
    solde: number;
  }[];
  expenses: {
    date: string;
    label: string;
    category: string;
    match: string;
    amount: number;
  }[];
  odcavInfo?: OdcavInfo;
}

export function FinancialReport({ data }: { data: ReportData }) {
  const balance = data.totalRevenue - data.totalExpenses;
  const hasDeductions = data.reportType === "complet" && data.odcavRate !== undefined;
  const odcavPct = data.odcavRate ? (data.odcavRate * 100).toFixed(0) : "5";
  const typeLabel =
    data.reportType === "complet"
      ? "Rapport complet"
      : data.reportType === "recettes"
        ? "Rapport recettes"
        : "Rapport dépenses";

  const odcav = data.odcavInfo;
  const hasOdcav = odcav && (odcav.nom || odcav.adresse || odcav.president);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>GUICHET FOOT</Text>
            <Text style={styles.zoneName}>{data.zoneName}</Text>
            <Text style={[styles.headerMeta, { marginTop: 6 }]}>{typeLabel}</Text>
            <Text style={styles.headerMeta}>Du {data.startDate} au {data.endDate}</Text>
            <Text style={styles.headerMeta}>Généré le {data.generatedAt}</Text>
          </View>

          {hasOdcav && (
            <View style={styles.odcavBlock}>
              {odcav.logoUrl ? (
                <Image src={odcav.logoUrl} style={styles.odcavLogo} />
              ) : null}
              {odcav.nom ? (
                <Text style={styles.odcavName}>{odcav.nom}</Text>
              ) : null}
              {odcav.adresse ? (
                <Text style={styles.odcavMeta}>{odcav.adresse}</Text>
              ) : null}
              {odcav.president ? (
                <Text style={styles.odcavMeta}>Président : {odcav.president}</Text>
              ) : null}
              {odcav.telephone ? (
                <Text style={styles.odcavMeta}>Tél : {odcav.telephone}</Text>
              ) : null}
              {odcav.email ? (
                <Text style={styles.odcavMeta}>{odcav.email}</Text>
              ) : null}
            </View>
          )}
        </View>

        {/* Synthèse */}
        <Text style={styles.sectionTitle}>Synthèse</Text>
        <View style={styles.summaryCard}>
          {(data.reportType === "complet" || data.reportType === "recettes") && (
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total recettes</Text>
              <Text style={[styles.summaryValue, { color: "#0D5C3F" }]}>
                {formatAmount(data.totalRevenue)}
              </Text>
            </View>
          )}
          {(data.reportType === "complet" || data.reportType === "depenses") && (
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total dépenses</Text>
              <Text style={[styles.summaryValue, { color: "#DC2626" }]}>
                {formatAmount(data.totalExpenses)}
              </Text>
            </View>
          )}
          {data.reportType === "complet" && (
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Solde net</Text>
              <Text style={[styles.summaryValue, { color: balance >= 0 ? "#16A571" : "#DC2626" }]}>
                {formatAmount(balance)}
              </Text>
            </View>
          )}
        </View>

        {/* Déductions ODCAV + plateforme — Rapport complet uniquement */}
        {hasDeductions && (
          <View style={{ marginBottom: 14 }}>
            {/* Bannière recettes brutes */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", backgroundColor: "#DC2626", padding: "5 10", marginBottom: 2 }}>
              <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: "#FFF", fontStyle: "italic" }}>RECETTES BRUTES</Text>
              <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: "#FFF" }}>{formatAmount(data.totalRevenue)}</Text>
            </View>

            {/* Total dépenses */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", borderWidth: 1, borderColor: "#000", padding: "5 10", marginBottom: 4 }}>
              <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold" }}>TOTAL DES DÉPENSES</Text>
              <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold" }}>{formatAmount(data.totalExpenses)}</Text>
            </View>

            {/* Distribution ODCAV + zone */}
            <View style={{ borderWidth: 0.5, borderColor: "#D1D5DB", marginBottom: 4 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", padding: "4 10", borderBottomWidth: 0.5, borderBottomColor: "#D1D5DB" }}>
                <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", fontStyle: "italic", color: "#1D4ED8" }}>
                  Commission ODCAV {odcavPct}%{data.odcavInfo?.nom ? `  (${data.odcavInfo.nom})` : ""}
                </Text>
                <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", fontStyle: "italic", color: "#1D4ED8" }}>
                  {formatAmount(data.odcavCommission ?? 0)}
                </Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", padding: "4 10" }}>
                <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", fontStyle: "italic", color: "#0D5C3F" }}>
                  Zone / ASC {(100 - (data.odcavRate ?? 0.05) * 100).toFixed(0)}%  ({data.zoneName})
                </Text>
                <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", fontStyle: "italic", color: "#0D5C3F" }}>
                  {formatAmount(Math.max(0, data.totalRevenue - data.totalExpenses - (data.odcavCommission ?? 0)))}
                </Text>
              </View>
            </View>

            {/* Frais plateforme */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", padding: "4 10", backgroundColor: "#FFF7ED", borderWidth: 0.5, borderColor: "#FED7AA", marginBottom: 4 }}>
              <Text style={{ fontSize: 8, color: "#C2410C" }}>Frais de plateforme Guichet Foot</Text>
              <Text style={{ fontSize: 8, color: "#C2410C", fontFamily: "Helvetica-Bold" }}>- {formatAmount(data.fraisPlateforme ?? 0)}</Text>
            </View>

            {/* Net à reverser */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", backgroundColor: "#0D5C3F", padding: "6 10" }}>
              <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: "#FFF" }}>NET À REVERSER À LA ZONE</Text>
              <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: "#FFF" }}>{formatAmount(Math.max(0, data.netZone ?? 0))}</Text>
            </View>
          </View>
        )}

        {/* Détail recettes */}
        {(data.reportType === "complet" || data.reportType === "recettes") &&
          data.revenueByMatch.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Détail recettes par match</Text>
              <View style={styles.headerRow}>
                <Text style={{ flex: 2.5, fontSize: 6, fontFamily: "Helvetica-Bold" }}>Match</Text>
                <Text style={{ flex: 0.7, fontSize: 6, fontFamily: "Helvetica-Bold", textAlign: "right" }}>Impr.</Text>
                <Text style={{ flex: 0.7, fontSize: 6, fontFamily: "Helvetica-Bold", textAlign: "right", color: "#DC2626" }}>Invendu</Text>
                <Text style={{ flex: 0.7, fontSize: 6, fontFamily: "Helvetica-Bold", textAlign: "right", color: "#15803D" }}>Facturés</Text>
                <Text style={{ flex: 1.3, fontSize: 6, fontFamily: "Helvetica-Bold", textAlign: "right" }}>Recettes</Text>
                <Text style={{ flex: 1.3, fontSize: 6, fontFamily: "Helvetica-Bold", textAlign: "right", color: "#DC2626" }}>Dépenses</Text>
                <Text style={{ flex: 1.3, fontSize: 6, fontFamily: "Helvetica-Bold", textAlign: "right" }}>Solde</Text>
              </View>
              {data.revenueByMatch.map((item, i) => (
                <View key={i} style={styles.row}>
                  <View style={{ flex: 2.5 }}>
                    <Text style={{ fontSize: 7 }}>{item.teams}</Text>
                    <Text style={{ fontSize: 6, color: "#6B7280" }}>{item.date}</Text>
                  </View>
                  <Text style={{ flex: 0.7, fontSize: 7, textAlign: "right" }}>{item.printed}</Text>
                  <Text style={{ flex: 0.7, fontSize: 7, textAlign: "right", color: "#DC2626" }}>{item.unsold}</Text>
                  <Text style={{ flex: 0.7, fontSize: 7, textAlign: "right", color: "#15803D" }}>{item.printed - item.unsold}</Text>
                  <Text style={{ flex: 1.3, fontSize: 7, textAlign: "right", color: "#0D5C3F" }}>{formatAmount(item.revenue)}</Text>
                  <Text style={{ flex: 1.3, fontSize: 7, textAlign: "right", color: "#DC2626" }}>
                    {item.matchExpenses > 0 ? `-${formatAmount(item.matchExpenses)}` : "—"}
                  </Text>
                  <Text style={{ flex: 1.3, fontSize: 7, textAlign: "right", fontFamily: "Helvetica-Bold", color: item.solde >= 0 ? "#16A571" : "#DC2626" }}>
                    {formatAmount(item.solde)}
                  </Text>
                </View>
              ))}
            </>
          )}

        {/* Détail dépenses */}
        {(data.reportType === "complet" || data.reportType === "depenses") &&
          data.expenses.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Détail dépenses</Text>
              <View style={styles.headerRow}>
                <Text style={{ flex: 1, fontSize: 8, fontFamily: "Helvetica-Bold" }}>Date</Text>
                <Text style={{ flex: 2, fontSize: 8, fontFamily: "Helvetica-Bold" }}>Libellé</Text>
                <Text style={{ flex: 1, fontSize: 8, fontFamily: "Helvetica-Bold" }}>Catégorie</Text>
                <Text style={{ flex: 1.5, fontSize: 8, fontFamily: "Helvetica-Bold", textAlign: "right" }}>Montant</Text>
              </View>
              {data.expenses.map((item, i) => (
                <View key={i} style={styles.row}>
                  <Text style={{ flex: 1, fontSize: 9 }}>{item.date}</Text>
                  <Text style={{ flex: 2, fontSize: 9 }}>{item.label}</Text>
                  <Text style={{ flex: 1, fontSize: 9 }}>{item.category}</Text>
                  <Text style={{ flex: 1.5, fontSize: 9, textAlign: "right" }}>
                    {formatAmount(item.amount)}
                  </Text>
                </View>
              ))}
            </>
          )}

        <Text style={styles.footer}>
          Généré par Guichet Foot le {data.generatedAt}
        </Text>
      </Page>
    </Document>
  );
}
