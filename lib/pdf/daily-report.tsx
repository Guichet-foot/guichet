import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

function fmtAmt(amount: number) {
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " FCFA";
}

const styles = StyleSheet.create({
  page: { padding: 35, fontSize: 10, fontFamily: "Helvetica" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    marginBottom: 22, paddingBottom: 15, borderBottomWidth: 2, borderBottomColor: "#0D5C3F",
  },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", color: "#0D5C3F" },
  subtitle: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 3 },
  meta: { fontSize: 8, color: "#6B7280", marginTop: 2 },
  sectionTitle: {
    fontSize: 11, fontFamily: "Helvetica-Bold", color: "#0D5C3F",
    marginBottom: 6, marginTop: 16,
  },
  tableHeader: {
    flexDirection: "row", paddingVertical: 5, paddingHorizontal: 8,
    backgroundColor: "#F0EDE8", borderBottomWidth: 2, borderBottomColor: "#0D5C3F",
  },
  row: {
    flexDirection: "row", paddingVertical: 5, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: "#E5E2DD",
  },
  summaryRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 8, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: "#E5E2DD",
  },
  summaryLabel: { fontSize: 9, color: "#374151" },
  summaryValue: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  totalRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: "#0D5C3F", borderRadius: 4, marginTop: 6,
  },
  totalLabel: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#FFFFFF" },
  totalValue: { fontSize: 13, fontFamily: "Helvetica-Bold", color: "#FFFFFF" },
  footer: {
    position: "absolute", bottom: 20, left: 35, right: 35,
    textAlign: "center", fontSize: 7, color: "#6B7280",
    borderTopWidth: 1, borderTopColor: "#E5E2DD", paddingTop: 6,
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
  revenueByMatch: { teams: string; sold: number; revenue: number }[];
  expenses: { label: string; category: string; amount: number }[];
}

export function DailyReport({ data }: { data: DailyReportData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* En-tête */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>GUICHET FOOT</Text>
            <Text style={styles.subtitle}>{data.zoneName}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 13, fontFamily: "Helvetica-Bold" }}>BILAN JOURNALIER</Text>
            <Text style={styles.meta}>Date : {data.date}</Text>
            <Text style={styles.meta}>Généré le {data.generatedAt}</Text>
          </View>
        </View>

        {/* Récapitulatif */}
        <Text style={styles.sectionTitle}>Récapitulatif financier du jour</Text>
        <View style={{ borderWidth: 1, borderColor: "#E5E2DD", borderRadius: 4, overflow: "hidden" }}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Recettes brutes de billetterie</Text>
            <Text style={[styles.summaryValue, { color: "#0D5C3F" }]}>{fmtAmt(data.totalRevenue)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Dépenses du jour</Text>
            <Text style={[styles.summaryValue, { color: "#DC2626" }]}>- {fmtAmt(data.totalExpenses)}</Text>
          </View>
          <View style={[styles.summaryRow, { backgroundColor: "#EFF6FF" }]}>
            <View>
              <Text style={[styles.summaryLabel, { color: "#1D4ED8", fontFamily: "Helvetica-Bold" }]}>
                Commission ODCAV ({(data.odcavRate * 100).toFixed(0)}% des recettes)
              </Text>
              <Text style={{ fontSize: 7, color: "#6B7280" }}>À reverser à l&apos;ODCAV</Text>
            </View>
            <Text style={[styles.summaryValue, { color: "#1D4ED8" }]}>- {fmtAmt(data.odcavCommission)}</Text>
          </View>
          <View style={[styles.summaryRow, { backgroundColor: "#FFF7ED" }]}>
            <View>
              <Text style={[styles.summaryLabel, { color: "#C2410C", fontFamily: "Helvetica-Bold" }]}>
                Frais de plateforme Guichet Foot
              </Text>
              <Text style={{ fontSize: 7, color: "#6B7280" }}>Frais d&apos;utilisation journalier</Text>
            </View>
            <Text style={[styles.summaryValue, { color: "#C2410C" }]}>- {fmtAmt(data.fraisPlateforme)}</Text>
          </View>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Net à reverser à la zone</Text>
          <Text style={styles.totalValue}>{fmtAmt(Math.max(0, data.netZone))}</Text>
        </View>

        {/* Détail recettes par match */}
        {data.revenueByMatch.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Détail recettes par match</Text>
            <View style={styles.tableHeader}>
              <Text style={{ flex: 4, fontSize: 8, fontFamily: "Helvetica-Bold" }}>Match</Text>
              <Text style={{ flex: 1, fontSize: 8, fontFamily: "Helvetica-Bold", textAlign: "right" }}>Billets</Text>
              <Text style={{ flex: 2, fontSize: 8, fontFamily: "Helvetica-Bold", textAlign: "right" }}>Recettes</Text>
            </View>
            {data.revenueByMatch.map((item, i) => (
              <View key={i} style={styles.row}>
                <Text style={{ flex: 4, fontSize: 9 }}>{item.teams}</Text>
                <Text style={{ flex: 1, fontSize: 9, textAlign: "right" }}>{item.sold}</Text>
                <Text style={{ flex: 2, fontSize: 9, textAlign: "right", fontFamily: "Helvetica-Bold" }}>
                  {fmtAmt(item.revenue)}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* Dépenses */}
        {data.expenses.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Dépenses du jour</Text>
            <View style={styles.tableHeader}>
              <Text style={{ flex: 3, fontSize: 8, fontFamily: "Helvetica-Bold" }}>Libellé</Text>
              <Text style={{ flex: 2, fontSize: 8, fontFamily: "Helvetica-Bold" }}>Catégorie</Text>
              <Text style={{ flex: 2, fontSize: 8, fontFamily: "Helvetica-Bold", textAlign: "right" }}>Montant</Text>
            </View>
            {data.expenses.map((item, i) => (
              <View key={i} style={styles.row}>
                <Text style={{ flex: 3, fontSize: 9 }}>{item.label}</Text>
                <Text style={{ flex: 2, fontSize: 9 }}>{item.category}</Text>
                <Text style={{ flex: 2, fontSize: 9, textAlign: "right" }}>{fmtAmt(item.amount)}</Text>
              </View>
            ))}
          </>
        )}

        <Text style={styles.footer}>
          Document généré automatiquement par Guichet Foot · Commission ODCAV ({(data.odcavRate * 100).toFixed(0)}%) prélevée sur les recettes brutes de billetterie
        </Text>
      </Page>
    </Document>
  );
}
