import React from "react";
import {
  Document, Page, View, Text, Image,
  Svg, Path, Circle, Rect, Line,
} from "@react-pdf/renderer";

// ── Units ──────────────────────────────────────────────────────────
const MM = 72 / 25.4;

export const CARD_W = 85.60 * MM;   // 242.65 pt
export const CARD_H = 53.98 * MM;   // 153.00 pt

const HEADER_H = CARD_H * 0.30;     // 45.90 pt  (30% like HTML)
const BODY_H   = CARD_H * 0.70;     // 107.10 pt

const INFO_W   = CARD_W * 0.65;     // 157.72 pt (65% of card)
const QR_COL_W = CARD_W * 0.35;     // 84.93 pt

// Photo: portrait rectangle — same width as before, but taller
const PHOTO_W  = CARD_W * 0.24;     // 58.24 pt
const PHOTO_H  = CARD_H * 0.55;     // 84.15 pt — spans header + top of body
const PHOTO_RADIUS = 4;             // rounded rectangle (not circle)

// ── Fonts: scaled to CARD_W exactly like cqi units in the HTML ─────
// HTML cartes-grid uses cqi (% of container inline-size = card width)
const F_TITLE  = CARD_W * 0.055;   // 5.5cqi  → 13.3 pt  (CARTE D'ACCÈS)
const F_SAISON = CARD_W * 0.021;   // 2.1cqi  →  5.1 pt
const F_BADGE  = CARD_W * 0.016;   // 1.6cqi  →  3.9 pt
const F_LABEL  = CARD_W * 0.016;   // 1.6cqi  →  3.9 pt
const F_VALUE  = CARD_W * 0.028;   // 2.8cqi  →  6.8 pt

// ── Icon box: 5.5cqi = 13.3 pt ────────────────────────────────────
const ICON_BOX  = CARD_W * 0.055;  // 13.35 pt
const ICON_SIZE = ICON_BOX * 0.60; //  8.0 pt  (icon inside box)

// ── Row height: fixed & compact so rows stack at top ──────────────
// F_LABEL + marginTop + F_VALUE + ~4pt vertical padding = ~16pt
const ROW_H = CARD_H * 0.105;      // 16.1 pt (fixed, NOT body/numRows)

// ── Types ──────────────────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  zone: "ZONE", delegue: "DÉLÉGUÉ", vendeur: "VENDEUR", spectateur: "SPECTATEUR",
};
const TYPE_COLORS: Record<string, string> = {
  zone: "#166534", delegue: "#1D4ED8", vendeur: "#B45309", spectateur: "#6D28D9",
};

export interface CardPDFData {
  full_name: string;
  phone: string;
  zone_name: string;
  poste: string | null;
  asc_name: string | null;
  card_type: string;
  price: number | null;
  saison: string | null;
  created_at: string;
  qrDataUrl: string;
  logoDataUrl: string;
  photoDataUrl: string | null;
}

// ── SVG Icons (Lucide paths, white stroke, viewBox 0 0 24 24) ──────
function IconUser() {
  return (
    <Svg viewBox="0 0 24 24" width={ICON_SIZE} height={ICON_SIZE}>
      <Path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"
        stroke="white" strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={12} cy={7} r={4}
        stroke="white" strokeWidth={2.2} fill="none" />
    </Svg>
  );
}

function IconPhone() {
  return (
    <Svg viewBox="0 0 24 24" width={ICON_SIZE} height={ICON_SIZE}>
      <Path
        d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.56 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
        stroke="white" strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function IconMapPin() {
  return (
    <Svg viewBox="0 0 24 24" width={ICON_SIZE} height={ICON_SIZE}>
      <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"
        stroke="white" strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={12} cy={10} r={3}
        stroke="white" strokeWidth={2.2} fill="none" />
    </Svg>
  );
}

function IconBriefcase() {
  return (
    <Svg viewBox="0 0 24 24" width={ICON_SIZE} height={ICON_SIZE}>
      <Rect x={2} y={7} width={20} height={14} rx={2}
        stroke="white" strokeWidth={2.2} fill="none" />
      <Path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"
        stroke="white" strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function IconShield() {
  return (
    <Svg viewBox="0 0 24 24" width={ICON_SIZE} height={ICON_SIZE}>
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
        stroke="white" strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function IconTag() {
  return (
    <Svg viewBox="0 0 24 24" width={ICON_SIZE} height={ICON_SIZE}>
      <Path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"
        stroke="white" strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Line x1={7} y1={7} x2={7.01} y2={7}
        stroke="white" strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

// ── Icon box: green rounded square, centered icon ──────────────────
function IconBox({ children }: { children: React.ReactNode }) {
  return (
    <View style={{
      width: ICON_BOX, height: ICON_BOX,
      backgroundColor: "#1a5c2a",
      borderRadius: ICON_BOX * 0.16,
      marginRight: CARD_W * 0.014, // ~3.4pt gap
      flexShrink: 0,
      alignItems: "center",
      justifyContent: "center",
    }}>
      {children}
    </View>
  );
}

interface CardRow { label: string; value: string; icon: React.ReactNode; }

function getSaison(card: CardPDFData): string {
  if (card.saison) return card.saison;
  const d = new Date(card.created_at);
  const y = d.getFullYear();
  return d.getMonth() + 1 >= 8 ? `${y} - ${y + 1}` : `${y - 1} - ${y}`;
}

// ── Card component ─────────────────────────────────────────────────
export function CardPDFView({ card }: { card: CardPDFData }) {
  const type      = card.card_type || "zone";
  const isPaid    = type === "vendeur" || type === "spectateur";
  const typeLabel = TYPE_LABELS[type] || "ZONE";
  const typeColor = TYPE_COLORS[type] || "#166534";
  const saison    = getSaison(card);

  const rows: CardRow[] = [
    { label: "NOM COMPLET", value: card.full_name,  icon: <IconUser /> },
    { label: "TÉLÉPHONE",   value: card.phone,       icon: <IconPhone /> },
    ...(!isPaid
      ? [{ label: "ZONE", value: card.zone_name, icon: <IconMapPin /> }]
      : []),
    ...(!isPaid && card.poste
      ? [{ label: "POSTE", value: card.poste, icon: <IconBriefcase /> }]
      : []),
    ...(card.asc_name
      ? [{ label: "ASC", value: card.asc_name, icon: <IconShield /> }]
      : []),
    ...(card.price
      ? [{ label: "MONTANT", value: `${card.price.toLocaleString("fr-FR")} FCFA`, icon: <IconTag /> }]
      : []),
  ];

  // Fixed compact row height — rows stack from top, empty space at bottom
  const rowH = ROW_H;
  // Row padding — 2% of card width like HTML's "padding: 0 2%"
  const rowPad = CARD_W * 0.02;

  // Padding to reserve space for the photo in the header title area
  const titlePadRight = PHOTO_W + CARD_W * 0.025;

  return (
    <View style={{
      width: CARD_W, height: CARD_H,
      borderWidth: 1.5, borderColor: "#1a5c2a", borderRadius: 5 * MM,
      overflow: "hidden", backgroundColor: "white",
      position: "relative",
    }}>

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <View style={{
        position: "absolute", top: 0, left: 0, width: CARD_W, height: HEADER_H,
        flexDirection: "row", alignItems: "center",
        backgroundColor: "#f0fdf4",
        borderBottomWidth: 1, borderBottomColor: "#1a5c2a",
        paddingHorizontal: CARD_W * 0.02,
        paddingVertical: CARD_H * 0.01,
      }}>
        {/* Logo */}
        <Image
          src={card.logoDataUrl}
          style={{
            width:  HEADER_H * 0.88,
            height: HEADER_H * 0.88,
            objectFit: "contain",
            flexShrink: 0,
          }}
        />

        {/* Title block — centred, with right padding for photo */}
        <View style={{ flex: 1, alignItems: "center", paddingRight: titlePadRight }}>
          <Text style={{
            fontFamily: "Helvetica-Bold",
            fontSize: F_TITLE,
            color: "#1a5c2a",
            lineHeight: 1.05,
            letterSpacing: 0.3,
          }}>
            CARTE D&apos;ACCÈS
          </Text>
          <Text style={{
            fontFamily: "Helvetica",
            fontSize: F_SAISON,
            color: "#166534",
            marginTop: CARD_H * 0.008,
            letterSpacing: 0.2,
          }}>
            — SAISON {saison} —
          </Text>
          {/* Type badge */}
          <View style={{
            marginTop: CARD_H * 0.012,
            backgroundColor: typeColor,
            borderRadius: 99,
            paddingHorizontal: CARD_W * 0.02,
            paddingVertical: CARD_H * 0.008,
          }}>
            <Text style={{
              fontFamily: "Helvetica-Bold",
              fontSize: F_BADGE,
              color: "white",
              letterSpacing: 0.5,
            }}>
              {typeLabel}
            </Text>
          </View>
        </View>
      </View>

      {/* ── BODY ───────────────────────────────────────────────── */}
      <View style={{
        position: "absolute", top: HEADER_H, left: 0,
        width: CARD_W, height: BODY_H,
        flexDirection: "row",
      }}>
        {/* Info column — 65% */}
        <View style={{
          width: INFO_W, height: BODY_H,
          borderRightWidth: 0.5, borderRightColor: "#e5e7eb",
          flexDirection: "column",
        }}>
          {rows.map(({ label, value, icon }, i) => (
            <View key={label} style={{
              width: INFO_W,
              height: rowH,
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: rowPad,
              borderBottomWidth: i < rows.length - 1 ? 0.4 : 0,
              borderBottomColor: "#e5e7eb",
            }}>
              <IconBox>{icon}</IconBox>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{
                  fontFamily: "Helvetica-Bold",
                  fontSize: F_LABEL,
                  color: "#166534",
                  letterSpacing: 0.3,
                  lineHeight: 1,
                }}>
                  {label}
                </Text>
                <Text style={{
                  fontFamily: "Helvetica-Bold",
                  fontSize: F_VALUE,
                  color: "#111",
                  marginTop: CARD_H * 0.007,
                  lineHeight: 1.1,
                }}>
                  {value}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* QR column — 35% */}
        <View style={{
          width: QR_COL_W, height: BODY_H,
          alignItems: "center",
          justifyContent: "flex-end",
          paddingBottom: CARD_H * 0.03,
        }}>
          <View style={{
            borderWidth: 0.8, borderColor: "#1a5c2a",
            padding: CARD_W * 0.007,
          }}>
            <Image
              src={card.qrDataUrl}
              style={{
                width:  QR_COL_W * 0.96,
                height: QR_COL_W * 0.96,
              }}
            />
          </View>
        </View>
      </View>

      {/* ── PHOTO — portrait rectangle, top-right, spans header+body ── */}
      <View style={{
        position: "absolute",
        top:   CARD_H * 0.03,
        right: CARD_W * 0.02,
        width:  PHOTO_W,
        height: PHOTO_H,
        borderRadius: PHOTO_RADIUS,
        borderWidth: 1.5,
        borderColor: "#1a5c2a",
        overflow: "hidden",
        backgroundColor: "#d1fae5",
      }}>
        {card.photoDataUrl ? (
          <Image
            src={card.photoDataUrl}
            style={{ width: PHOTO_W, height: PHOTO_H, objectFit: "cover" }}
          />
        ) : null}
      </View>
    </View>
  );
}

// ── Single card PDF (page = card dimensions) ───────────────────────
export function SingleCardPDF({ card }: { card: CardPDFData }) {
  return (
    <Document>
      <Page size={[CARD_W, CARD_H]} style={{ padding: 0 }}>
        <CardPDFView card={card} />
      </Page>
    </Document>
  );
}

// ── Bulk A4 PDF — 2 cards per row ──────────────────────────────────
const A4_W = 595.28;
const A4_H = 841.89;

const GAP_H    = 7 * MM;                              // gap between 2 columns
const MARGIN_H = (A4_W - 2 * CARD_W - GAP_H) / 2;   // horizontal margin
const MARGIN_V = 10 * MM;                             // top/bottom margin
const GAP_V    = 5 * MM;                              // gap between rows
const STRIDE_V = CARD_H + GAP_V;

const ROWS_PER_PAGE = Math.floor(
  (A4_H - 2 * MARGIN_V + GAP_V) / STRIDE_V
);

export function BulkCardsPDF({ cards }: { cards: CardPDFData[] }) {
  const PER_PAGE = ROWS_PER_PAGE * 2;
  const pages: CardPDFData[][] = [];
  for (let i = 0; i < cards.length; i += PER_PAGE) {
    pages.push(cards.slice(i, i + PER_PAGE));
  }

  return (
    <Document>
      {pages.map((pageCards, pi) => (
        <Page key={pi} size="A4" style={{ padding: 0, backgroundColor: "white" }}>
          {pageCards.map((card, ci) => {
            const col = ci % 2;
            const row = Math.floor(ci / 2);
            return (
              <View key={ci} style={{
                position: "absolute",
                left: MARGIN_H + col * (CARD_W + GAP_H),
                top:  MARGIN_V + row * STRIDE_V,
              }}>
                <CardPDFView card={card} />
              </View>
            );
          })}
        </Page>
      ))}
    </Document>
  );
}
