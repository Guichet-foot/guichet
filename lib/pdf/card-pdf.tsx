import React from "react";
import { Document, Page, View, Text, Image } from "@react-pdf/renderer";

// 1mm = 72/25.4 pt
const MM = 72 / 25.4;
export const CARD_W = 85.60 * MM; // 242.65 pt
export const CARD_H = 53.98 * MM; // 153.00 pt
const HEADER_H = CARD_H * 0.30;   // 45.90 pt
const BODY_H   = CARD_H - HEADER_H;
const INFO_W   = CARD_W * 0.65;   // 157.72 pt
const QR_COL_W = CARD_W * 0.35;   // 84.93 pt
const PHOTO_D  = CARD_H * 0.42;   // 64.26 pt  (~22.7mm)

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

function getSaison(card: CardPDFData): string {
  if (card.saison) return card.saison;
  const d = new Date(card.created_at);
  const y = d.getFullYear();
  return d.getMonth() + 1 >= 8 ? `${y} - ${y + 1}` : `${y - 1} - ${y}`;
}

export function CardPDFView({ card }: { card: CardPDFData }) {
  const type = card.card_type || "zone";
  const isPaid = type === "vendeur" || type === "spectateur";
  const typeLabel = TYPE_LABELS[type] || "ZONE";
  const typeColor = TYPE_COLORS[type] || "#166534";
  const saison = getSaison(card);

  const rows: { label: string; value: string }[] = [
    { label: "NOM COMPLET", value: card.full_name },
    { label: "TÉLÉPHONE",   value: card.phone },
    { label: "ZONE",        value: card.zone_name },
    ...(!isPaid && card.poste ? [{ label: "POSTE", value: card.poste }] : []),
    ...(card.asc_name ? [{ label: "ASC", value: card.asc_name }] : []),
    ...(card.price ? [{ label: "MONTANT", value: `${card.price.toLocaleString("fr-FR")} FCFA` }] : []),
  ];

  const rowH = BODY_H / rows.length;

  return (
    <View style={{
      width: CARD_W, height: CARD_H,
      borderWidth: 1.5, borderColor: "#1a5c2a", borderRadius: 6,
      overflow: "hidden", backgroundColor: "white", position: "relative",
    }}>
      {/* ── HEADER ── */}
      <View style={{
        position: "absolute", top: 0, left: 0, width: CARD_W, height: HEADER_H,
        flexDirection: "row", alignItems: "center",
        backgroundColor: "#f0fdf4",
        borderBottomWidth: 1, borderBottomColor: "#1a5c2a",
        paddingHorizontal: 4, paddingVertical: 2,
      }}>
        {/* Logo — transparent, no white box */}
        <Image
          src={card.logoDataUrl}
          style={{ width: HEADER_H - 6, height: HEADER_H - 6, objectFit: "contain" }}
        />

        {/* Title block — centered, padding-right leaves room for the photo circle */}
        <View style={{
          flex: 1,
          alignItems: "center",
          paddingRight: PHOTO_D * 0.9,
        }}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 8.5, color: "#1a5c2a", lineHeight: 1.05 }}>
            CARTE D&apos;ACCÈS
          </Text>
          <Text style={{ fontFamily: "Helvetica", fontSize: 4.2, color: "#166534", marginTop: 1.5 }}>
            — SAISON {saison} —
          </Text>
          <View style={{
            marginTop: 2, borderRadius: 99,
            backgroundColor: typeColor,
            paddingHorizontal: 5, paddingVertical: 1.2,
          }}>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 3.2, color: "white", letterSpacing: 0.5 }}>
              {typeLabel}
            </Text>
          </View>
        </View>
      </View>

      {/* ── BODY ── */}
      <View style={{
        position: "absolute", top: HEADER_H, left: 0,
        width: CARD_W, height: BODY_H,
        flexDirection: "row",
      }}>
        {/* Info column */}
        <View style={{
          width: INFO_W, height: BODY_H,
          borderRightWidth: 0.5, borderRightColor: "#e5e7eb",
          flexDirection: "column",
        }}>
          {rows.map(({ label, value }, i) => (
            <View key={label} style={{
              width: INFO_W,
              height: rowH,
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 3,
              borderBottomWidth: i < rows.length - 1 ? 0.3 : 0,
              borderBottomColor: "#e5e7eb",
            }}>
              {/* Icon square (no SVG needed) */}
              <View style={{
                width: 7, height: 7,
                backgroundColor: "#1a5c2a", borderRadius: 1.2,
                marginRight: 2.5, flexShrink: 0,
              }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 3, color: "#166534", letterSpacing: 0.2 }}>
                  {label}
                </Text>
                <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 5, color: "#111", marginTop: 0.5 }}>
                  {value}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* QR column */}
        <View style={{
          width: QR_COL_W, height: BODY_H,
          alignItems: "center", justifyContent: "flex-end",
          paddingBottom: 5,
        }}>
          <View style={{ borderWidth: 0.5, borderColor: "#1a5c2a", padding: 1 }}>
            <Image src={card.qrDataUrl} style={{ width: QR_COL_W * 0.68, height: QR_COL_W * 0.68 }} />
          </View>
        </View>
      </View>

      {/* ── PHOTO — absolute circle, top-right ── */}
      <View style={{
        position: "absolute", top: 3, right: 3,
        width: PHOTO_D, height: PHOTO_D,
        borderRadius: PHOTO_D / 2,
        borderWidth: 1.5, borderColor: "#1a5c2a",
        overflow: "hidden", backgroundColor: "#d1fae5",
      }}>
        {card.photoDataUrl ? (
          <Image src={card.photoDataUrl} style={{ width: PHOTO_D, height: PHOTO_D, objectFit: "cover" }} />
        ) : null}
      </View>
    </View>
  );
}

/* ── Single card PDF — page size = credit card ── */
export function SingleCardPDF({ card }: { card: CardPDFData }) {
  return (
    <Document>
      <Page size={[CARD_W, CARD_H]} style={{ padding: 0 }}>
        <CardPDFView card={card} />
      </Page>
    </Document>
  );
}

/* ── Bulk A4 PDF — 2 cards per row ── */
const A4_W = 595.28;
const A4_H = 841.89;
// Center 2 cards horizontally with a 7mm gap
const GAP_H  = 7 * MM;                         // 19.84pt between cols
const MARGIN_H = (A4_W - 2 * CARD_W - GAP_H) / 2; // ~15.1mm each side
const MARGIN_V = 10 * MM;                       // 28.35pt top/bottom
const GAP_V  = 5 * MM;                          // 14.17pt between rows
const STRIDE_V = CARD_H + GAP_V;               // 167.17pt per row
const ROWS_PER_PAGE = Math.floor((A4_H - 2 * MARGIN_V + GAP_V) / STRIDE_V); // 4 rows

export function BulkCardsPDF({ cards }: { cards: CardPDFData[] }) {
  const CARDS_PER_PAGE = ROWS_PER_PAGE * 2;

  const pages: CardPDFData[][] = [];
  for (let i = 0; i < cards.length; i += CARDS_PER_PAGE) {
    pages.push(cards.slice(i, i + CARDS_PER_PAGE));
  }

  return (
    <Document>
      {pages.map((pageCards, pi) => (
        <Page key={pi} size="A4" style={{ padding: 0, backgroundColor: "white" }}>
          {pageCards.map((card, ci) => {
            const col = ci % 2;
            const row = Math.floor(ci / 2);
            const x = MARGIN_H + col * (CARD_W + GAP_H);
            const y = MARGIN_V + row * STRIDE_V;
            return (
              <View key={ci} style={{ position: "absolute", left: x, top: y }}>
                <CardPDFView card={card} />
              </View>
            );
          })}
        </Page>
      ))}
    </Document>
  );
}
