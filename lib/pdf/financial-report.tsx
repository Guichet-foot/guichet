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
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  coverPage: {
    padding: 40,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  },
  title: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: "#0D5C3F",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 5,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#0D5C3F",
    marginBottom: 10,
    marginTop: 20,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E2DD",
    paddingVertical: 6,
  },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 2,
    borderBottomColor: "#0D5C3F",
    paddingVertical: 6,
    backgroundColor: "#F0EDE8",
  },
  cell: {
    flex: 1,
    fontSize: 9,
  },
  cellRight: {
    flex: 1,
    fontSize: 9,
    textAlign: "right",
  },
  headerCell: {
    flex: 1,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },
  headerCellRight: {
    flex: 1,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
  },
  summaryCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 10,
  },
  summaryItem: {
    flex: 1,
    padding: 15,
    backgroundColor: "#F0EDE8",
    borderRadius: 4,
  },
  summaryLabel: {
    fontSize: 9,
    color: "#6B7280",
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 8,
    color: "#6B7280",
  },
});

function formatAmount(amount: number) {
  return new Intl.NumberFormat("fr-FR").format(amount) + " FCFA";
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
      <Page size="A4" style={styles.coverPage}>
        <Text style={styles.title}>GUICHET FOOT</Text>
        <Text style={{ fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 20 }}>
          {data.zoneName}
        </Text>
        <Text style={{ fontSize: 16, marginBottom: 10 }}>{typeLabel}</Text>
        <Text style={styles.subtitle}>
          Du {data.startDate} au {data.endDate}
        </Text>
        <Text style={{ fontSize: 9, color: "#6B7280", marginTop: 40 }}>
          Généré le {data.generatedAt}
        </Text>
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Synthèse</Text>

        <View style={styles.summaryCard}>
          {(data.reportType === "complet" ||
            data.reportType === "recettes") && (
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total recettes</Text>
              <Text style={[styles.summaryValue, { color: "#0D5C3F" }]}>
                {formatAmount(data.totalRevenue)}
              </Text>
            </View>
          )}
          {(data.reportType === "complet" ||
            data.reportType === "depenses") && (
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
              <Text
                style={[
                  styles.summaryValue,
                  { color: balance >= 0 ? "#16A571" : "#DC2626" },
                ]}
              >
                {formatAmount(balance)}
              </Text>
            </View>
          )}
        </View>

        {(data.reportType === "complet" ||
          data.reportType === "recettes") &&
          data.revenueByMatch.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Détail recettes</Text>
              <View style={styles.headerRow}>
                <Text style={styles.headerCell}>Match</Text>
                <Text style={styles.headerCell}>Date</Text>
                <Text style={styles.headerCellRight}>Billets</Text>
                <Text style={styles.headerCellRight}>Recettes</Text>
              </View>
              {data.revenueByMatch.map((item, i) => (
                <View key={i} style={styles.row}>
                  <Text style={styles.cell}>{item.teams}</Text>
                  <Text style={styles.cell}>{item.date}</Text>
                  <Text style={styles.cellRight}>{item.sold}</Text>
                  <Text style={styles.cellRight}>
                    {formatAmount(item.revenue)}
                  </Text>
                </View>
              ))}
            </>
          )}

        {(data.reportType === "complet" ||
          data.reportType === "depenses") &&
          data.expenses.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Détail dépenses</Text>
              <View style={styles.headerRow}>
                <Text style={styles.headerCell}>Date</Text>
                <Text style={styles.headerCell}>Libellé</Text>
                <Text style={styles.headerCell}>Catégorie</Text>
                <Text style={styles.headerCellRight}>Montant</Text>
              </View>
              {data.expenses.map((item, i) => (
                <View key={i} style={styles.row}>
                  <Text style={styles.cell}>{item.date}</Text>
                  <Text style={styles.cell}>{item.label}</Text>
                  <Text style={styles.cell}>{item.category}</Text>
                  <Text style={styles.cellRight}>
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
