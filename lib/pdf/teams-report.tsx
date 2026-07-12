import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Svg,
  Rect,
} from "@react-pdf/renderer";

export interface TeamRow {
  name: string;
  president: string | null;
  delegates: string[];
  colorsOfficial: [string, string] | null;
  colorsSub: [string, string] | null;
}

export interface ZoneSection {
  zoneName: string;
  teams: TeamRow[];
}

interface Props {
  zones: ZoneSection[];
  generatedAt: string;
  odcavName?: string;
  totalTeams: number;
}

const GREEN = "#0D5C3F";
const LIGHT_GREEN = "#E8F5EF";
const GRAY = "#6B7280";
const BORDER = "#E5E7EB";
const ROW_ALT = "#F9FAFB";

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 9,
    fontFamily: "Helvetica",
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: GREEN,
  },
  headerLeft: { flex: 1 },
  title: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: GREEN,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 10,
    color: GRAY,
    marginTop: 3,
  },
  headerRight: { alignItems: "flex-end" },
  meta: { fontSize: 8, color: GRAY, marginTop: 2 },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 18,
  },
  summaryBox: {
    flex: 1,
    backgroundColor: LIGHT_GREEN,
    borderRadius: 6,
    padding: 10,
    alignItems: "center",
  },
  summaryValue: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: GREEN,
  },
  summaryLabel: { fontSize: 8, color: GRAY, marginTop: 2 },
  zoneBlock: { marginBottom: 18 },
  zoneHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GREEN,
    borderRadius: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 0,
  },
  zoneTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    flex: 1,
  },
  zoneBadge: {
    fontSize: 8,
    color: "rgba(255,255,255,0.8)",
    fontFamily: "Helvetica-Bold",
  },
  table: { borderWidth: 1, borderColor: BORDER, borderRadius: 4, overflow: "hidden" },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tableRow: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tableRowAlt: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: ROW_ALT,
  },
  colNum: { width: 24, fontSize: 8, color: GRAY },
  colName: { flex: 2, fontSize: 9, fontFamily: "Helvetica-Bold", color: "#111827" },
  colNameHead: { flex: 2, fontSize: 8, fontFamily: "Helvetica-Bold", color: GRAY, textTransform: "uppercase" },
  colPres: { flex: 2, fontSize: 8, color: "#374151" },
  colPresHead: { flex: 2, fontSize: 8, fontFamily: "Helvetica-Bold", color: GRAY, textTransform: "uppercase" },
  colDel: { flex: 3, fontSize: 8, color: "#374151" },
  colDelHead: { flex: 3, fontSize: 8, fontFamily: "Helvetica-Bold", color: GRAY, textTransform: "uppercase" },
  colColor: { width: 52, alignItems: "center" },
  colColorHead: { width: 52, fontSize: 8, fontFamily: "Helvetica-Bold", color: GRAY, textTransform: "uppercase", textAlign: "center" },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 6,
  },
  footerText: { fontSize: 7, color: GRAY },
  emptyRow: { paddingHorizontal: 8, paddingVertical: 8 },
  emptyText: { fontSize: 8, color: GRAY, fontStyle: "italic" },
});

function ColorSwatch({ hex1, hex2, label }: { hex1: string; hex2: string; label: string }) {
  return (
    <View style={{ alignItems: "center", gap: 2 }}>
      <Svg width={18} height={18} style={{ borderRadius: 3 }}>
        <Rect x="0" y="0" width="9" height="18" fill={hex1} />
        <Rect x="9" y="0" width="9" height="18" fill={hex2} />
      </Svg>
      <Text style={{ fontSize: 6, color: GRAY }}>{label}</Text>
    </View>
  );
}

export function TeamsReport({ zones, generatedAt, odcavName, totalTeams }: Props) {
  const totalZones = zones.length;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Liste des Équipes</Text>
            {odcavName && <Text style={styles.subtitle}>{odcavName}</Text>}
            <Text style={styles.subtitle}>Toutes zones — Navétane</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.meta}>Généré le {generatedAt}</Text>
            <Text style={styles.meta}>guichetfoot.com</Text>
          </View>
        </View>

        {/* Summary */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryValue}>{totalTeams}</Text>
            <Text style={styles.summaryLabel}>Équipes au total</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryValue}>{totalZones}</Text>
            <Text style={styles.summaryLabel}>Zones représentées</Text>
          </View>
        </View>

        {/* Zones */}
        {zones.map((zone) => (
          <View key={zone.zoneName} style={styles.zoneBlock}>
            <View style={styles.zoneHeader}>
              <Text style={styles.zoneTitle}>{zone.zoneName}</Text>
              <Text style={styles.zoneBadge}>{zone.teams.length} équipe{zone.teams.length !== 1 ? "s" : ""}</Text>
            </View>

            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.colNum}>#</Text>
                <Text style={styles.colNameHead}>Nom ASC</Text>
                <Text style={styles.colPresHead}>Président</Text>
                <Text style={styles.colDelHead}>Délégué(s)</Text>
                <Text style={styles.colColorHead}>Couleurs</Text>
              </View>

              {zone.teams.length === 0 ? (
                <View style={styles.emptyRow}>
                  <Text style={styles.emptyText}>Aucune équipe dans cette zone</Text>
                </View>
              ) : (
                zone.teams.map((team, i) => (
                  <View key={i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                    <Text style={styles.colNum}>{i + 1}</Text>
                    <Text style={styles.colName}>{team.name}</Text>
                    <Text style={styles.colPres}>{team.president || "—"}</Text>
                    <Text style={styles.colDel}>
                      {team.delegates.length > 0 ? team.delegates.join(", ") : "—"}
                    </Text>
                    <View style={styles.colColor}>
                      <View style={{ flexDirection: "row", gap: 3, justifyContent: "center" }}>
                        {team.colorsOfficial && (
                          <ColorSwatch hex1={team.colorsOfficial[0]} hex2={team.colorsOfficial[1]} label="Off." />
                        )}
                        {team.colorsSub && (
                          <ColorSwatch hex1={team.colorsSub[0]} hex2={team.colorsSub[1]} label="Sub." />
                        )}
                        {!team.colorsOfficial && !team.colorsSub && (
                          <Text style={{ fontSize: 8, color: GRAY }}>—</Text>
                        )}
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        ))}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Guichet Foot — {odcavName || "Navétane"}</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
