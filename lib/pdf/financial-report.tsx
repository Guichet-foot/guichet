import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
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
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: "#0D5C3F",
  },
  headerLeft: {},
  headerRight: {
    textAlign: "right",
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

interface ReportData {
  zoneName: string;
  startDate: string;
  endDate: string;
  reportType: string;
  generatedAt: string;
  totalRevenue: number;
  totalExpenses: number;
  revenueByMatch: {
    teams: string;
    date: string;
    sold: number;
    revenue: number;
  }[];
  expenses: {
    date: string;
    label: string;
    category: string;
    match: string;
    amount: number;
  }[];
}

export function FinancialReport({ data }: { data: ReportData }) {
  const balance = data.totalRevenue - data.totalExpenses;
  const typeLabel =
    data.reportType === "complet"
      ? "Rapport complet"
      : data.reportType === "recettes"
        ? "Rapport recettes"
        : "Rapport dépenses";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header compact */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>GUICHET FOOT</Text>
            <Text style={styles.zoneName}>{data.zoneName}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold" }}>{typeLabel}</Text>
            <Text style={styles.headerMeta}>Du {data.startDate} au {data.endDate}</Text>
            <Text style={styles.headerMeta}>Généré le {data.generatedAt}</Text>
          </View>
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

        {/* Détail recettes */}
        {(data.reportType === "complet" || data.reportType === "recettes") &&
          data.revenueByMatch.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Détail recettes</Text>
              <View style={styles.headerRow}>
                <Text style={{ flex: 3, fontSize: 8, fontFamily: "Helvetica-Bold" }}>Match</Text>
                <Text style={{ flex: 1, fontSize: 8, fontFamily: "Helvetica-Bold" }}>Date</Text>
                <Text style={{ flex: 1, fontSize: 8, fontFamily: "Helvetica-Bold", textAlign: "right" }}>Billets</Text>
                <Text style={{ flex: 1.5, fontSize: 8, fontFamily: "Helvetica-Bold", textAlign: "right" }}>Recettes</Text>
              </View>
              {data.revenueByMatch.map((item, i) => (
                <View key={i} style={styles.row}>
                  <Text style={{ flex: 3, fontSize: 9 }}>{item.teams}</Text>
                  <Text style={{ flex: 1, fontSize: 9 }}>{item.date}</Text>
                  <Text style={{ flex: 1, fontSize: 9, textAlign: "right" }}>{item.sold}</Text>
                  <Text style={{ flex: 1.5, fontSize: 9, textAlign: "right" }}>
                    {formatAmount(item.revenue)}
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
