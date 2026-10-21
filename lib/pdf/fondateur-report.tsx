import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import fs from "fs";
import path from "path";

// Static ODCAV logo for the header — read once at module load (this file only
// ever runs server-side, inside renderToBuffer()), not per-request.
const odcavLogo: Buffer | null = (() => {
  try {
    return fs.readFileSync(path.join(process.cwd(), "public", "logoodcavdes.png"));
  } catch {
    return null;
  }
})();

function fmt(n: number) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " FCFA";
}

// Plain count, no currency suffix. Deliberately NOT `.toLocaleString("fr-FR")`:
// that inserts a Unicode narrow no-break space (U+202F) as the thousands
// separator, which the PDF's standard Helvetica font has no glyph for and
// renders as a mangled "/" (e.g. 23121 showed up as "23/121" in print).
// Reusing fmt()'s own separator (not retyping it) keeps the exact same,
// already-proven-safe character.
function fmtN(n: number): string {
  return fmt(n).slice(0, -" FCFA".length);
}

export interface FondateurReportRow {
  organisateur: string;
  type: "zone" | "c3";
  date: string;
  billetsScanned: number;
  recettesBrutes: number;
  commission: number;
  frais: number;
  recetteNette: number;
}

export interface FondateurReportData {
  scopeLabel: string | null;
  periodLabel: string;
  generatedAt: string;
  odcavRate: number;
  rows: FondateurReportRow[];
  totals: {
    billetsScanned: number;
    recettesBrutes: number;
    commission: number;
    frais: number;
    recetteNette: number;
  };
}

const s = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: "Helvetica" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: "#0D5C3F",
  },
  title: { fontSize: 17, fontFamily: "Helvetica-Bold", color: "#0D5C3F" },
  meta: { fontSize: 8, color: "#6B7280", marginTop: 2 },
  odcavLogo: { width: 46, height: 46, objectFit: "contain" },
  summaryRow: { flexDirection: "row", gap: 6, marginBottom: 14 },
  summaryCard: { flex: 1, padding: 9, backgroundColor: "#F0EDE8", borderRadius: 3 },
  summaryLabel: { fontSize: 7, color: "#6B7280", marginBottom: 2 },
  summaryValue: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  thRow: {
    flexDirection: "row",
    backgroundColor: "#0D5C3F",
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  thText: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#FFFFFF" },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E2DD",
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  rowAlt: { backgroundColor: "#F9F9F7" },
  cell: { fontSize: 7 },
  totRow: {
    flexDirection: "row",
    backgroundColor: "#0D5C3F",
    paddingVertical: 6,
    paddingHorizontal: 6,
    marginTop: 1,
  },
  totCell: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#FFFFFF" },
  footer: {
    position: "absolute",
    bottom: 18,
    left: 28,
    right: 28,
    textAlign: "center",
    fontSize: 7,
    color: "#9CA3AF",
  },
});

const COL = { date: 0.9, org: 2.0, type: 0.55, validés: 0.8, brutes: 1.4, commission: 1.25, frais: 1.2, nette: 1.4 };

export function FondateurReport({ data }: { data: FondateurReportData }) {
  const odcavPct = (data.odcavRate * 100).toFixed(0);
  const organisateurCount = new Set(data.rows.map((r) => r.organisateur)).size;

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.title}>
              GUICHET FOOT — Rapport Financier{data.scopeLabel ? ` — ${data.scopeLabel}` : ""}
            </Text>
            <Text style={s.meta}>{data.periodLabel}</Text>
            <Text style={s.meta}>Généré le {data.generatedAt}</Text>
          </View>
          {odcavLogo && <Image src={{ data: odcavLogo, format: "png" }} style={s.odcavLogo} />}
        </View>

        {/* Summary cards */}
        <View style={s.summaryRow}>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>Recettes Brutes</Text>
            <Text style={[s.summaryValue, { color: "#0D5C3F" }]}>{fmt(data.totals.recettesBrutes)}</Text>
            <Text style={[s.summaryLabel, { marginTop: 3 }]}>{fmtN(data.totals.billetsScanned)} billets validés</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>Commission ODCAV ({odcavPct}%)</Text>
            <Text style={[s.summaryValue, { color: "#1D4ED8" }]}>{fmt(data.totals.commission)}</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>Frais Billetterie</Text>
            <Text style={[s.summaryValue, { color: "#C2410C" }]}>{fmt(data.totals.frais)}</Text>
            <Text style={[s.summaryLabel, { marginTop: 3 }]}>{fmtN(data.totals.billetsScanned)} × 10 FCFA</Text>
          </View>
          <View style={[s.summaryCard, { backgroundColor: data.totals.recetteNette >= 0 ? "#ECFDF5" : "#FEF2F2" }]}>
            <Text style={s.summaryLabel}>Recette Nette</Text>
            <Text style={[s.summaryValue, { color: data.totals.recetteNette >= 0 ? "#16A34A" : "#DC2626" }]}>
              {fmt(data.totals.recetteNette)}
            </Text>
            <Text style={[s.summaryLabel, { marginTop: 3 }]}>Brutes − Commission − Frais</Text>
          </View>
        </View>

        {/* Table header */}
        <View style={s.thRow}>
          <Text style={[s.thText, { flex: COL.date }]}>Date</Text>
          <Text style={[s.thText, { flex: COL.org }]}>Organisateur</Text>
          <Text style={[s.thText, { flex: COL.type, textAlign: "center" }]}>Type</Text>
          <Text style={[s.thText, { flex: COL.validés, textAlign: "right" }]}>Billets</Text>
          <Text style={[s.thText, { flex: COL.brutes, textAlign: "right" }]}>Recettes Brutes</Text>
          <Text style={[s.thText, { flex: COL.commission, textAlign: "right" }]}>Commission {odcavPct}%</Text>
          <Text style={[s.thText, { flex: COL.frais, textAlign: "right" }]}>Frais Billetterie</Text>
          <Text style={[s.thText, { flex: COL.nette, textAlign: "right" }]}>Recette Nette</Text>
        </View>

        {/* Table rows — one per organizer per scan day */}
        {data.rows.map((row, i) => (
          <View key={i} style={[s.row, i % 2 === 1 ? s.rowAlt : {}]}>
            <Text style={[s.cell, { flex: COL.date }]}>{row.date}</Text>
            <Text style={[s.cell, { flex: COL.org }]}>{row.organisateur}</Text>
            <Text style={[s.cell, { flex: COL.type, textAlign: "center", color: row.type === "c3" ? "#1D4ED8" : "#15803D" }]}>
              {row.type === "c3" ? "C3" : "Zone"}
            </Text>
            <Text style={[s.cell, { flex: COL.validés, textAlign: "right" }]}>
              {fmtN(row.billetsScanned)}
            </Text>
            <Text style={[s.cell, { flex: COL.brutes, textAlign: "right", fontFamily: "Helvetica-Bold", color: "#0D5C3F" }]}>
              {fmt(row.recettesBrutes)}
            </Text>
            <Text style={[s.cell, { flex: COL.commission, textAlign: "right", color: "#1D4ED8" }]}>
              {fmt(row.commission)}
            </Text>
            <Text style={[s.cell, { flex: COL.frais, textAlign: "right", color: "#C2410C" }]}>
              {fmt(row.frais)}
            </Text>
            <Text style={[s.cell, { flex: COL.nette, textAlign: "right", fontFamily: "Helvetica-Bold", color: row.recetteNette >= 0 ? "#16A34A" : "#DC2626" }]}>
              {fmt(row.recetteNette)}
            </Text>
          </View>
        ))}

        {/* Totals row */}
        <View style={s.totRow}>
          <Text style={[s.totCell, { flex: COL.date + COL.org + COL.type + COL.validés }]}>
            TOTAUX — {organisateurCount} organisateur{organisateurCount !== 1 ? "s" : ""}
          </Text>
          <Text style={[s.totCell, { flex: COL.brutes, textAlign: "right" }]}>{fmt(data.totals.recettesBrutes)}</Text>
          <Text style={[s.totCell, { flex: COL.commission, textAlign: "right" }]}>{fmt(data.totals.commission)}</Text>
          <Text style={[s.totCell, { flex: COL.frais, textAlign: "right" }]}>{fmt(data.totals.frais)}</Text>
          <Text style={[s.totCell, { flex: COL.nette, textAlign: "right" }]}>{fmt(data.totals.recetteNette)}</Text>
        </View>

        <Text style={s.footer}>Généré par Guichet Foot · {data.generatedAt}</Text>
      </Page>
    </Document>
  );
}
