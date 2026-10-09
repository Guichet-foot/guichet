import React from "react";
import { Document, Page, View, Text, Image } from "@react-pdf/renderer";

// ── Units ──────────────────────────────────────────────────────────
const MM = 72 / 25.4;

export const TICKET_W = 148 * MM; // A5 portrait — 419.53 pt
export const TICKET_H = 210 * MM; // 595.28 pt

const PHOTO_TOP = TICKET_H * 0.63;
const PHOTO_H = TICKET_H - PHOTO_TOP;
const QR_BOX = 104;
const QR_FLOAT = QR_BOX * 0.32; // how far the QR box rises above the photo seam
const PAD_H = TICKET_W * 0.06;

export interface CustomTicketMatch {
  home: string;
  away: string;
}

export interface CustomTicketPDFData {
  serialNumber: string;
  createdAtLabel: string;
  sellerName: string;
  qrDataUrl: string;
  title: string;
  priceLabel: string;
  matches: CustomTicketMatch[];
  venue: string | null;
  gfLogoDataUrl: string;
  organizerLogoDataUrl: string | null;
  backgroundDataUrl: string | null;
}

function Pill({ children, size = 9 }: { children: React.ReactNode; size?: number }) {
  return (
    <View style={{
      alignSelf: "center",
      backgroundColor: "#0a0a0a",
      borderRadius: 99,
      paddingHorizontal: TICKET_W * 0.04,
      paddingVertical: 5,
      marginTop: 6,
    }}>
      <Text style={{ fontFamily: "Helvetica-Bold", fontSize: size, color: "#fff", letterSpacing: 0.5 }}>
        {children}
      </Text>
    </View>
  );
}

export function CustomTicketPDFView({ t }: { t: CustomTicketPDFData }) {
  return (
    <View style={{ width: TICKET_W, height: TICKET_H, backgroundColor: "#fff", position: "relative" }}>
      {/* ── Background photo (lower section) ──────────────────────── */}
      {t.backgroundDataUrl && (
        <Image
          src={t.backgroundDataUrl}
          style={{
            position: "absolute", left: 0, top: PHOTO_TOP,
            width: TICKET_W, height: PHOTO_H, objectFit: "cover",
          }}
        />
      )}
      {/* Dark overlay over the photo for text contrast */}
      {t.backgroundDataUrl && (
        <View style={{
          position: "absolute", left: 0, top: PHOTO_TOP,
          width: TICKET_W, height: PHOTO_H,
          backgroundColor: "#000", opacity: 0.32,
        }} />
      )}

      {/* ── Header: logos ──────────────────────────────────────────── */}
      <View style={{
        flexDirection: "row", alignItems: "center", justifyContent: "center",
        paddingTop: 16, paddingHorizontal: PAD_H,
      }}>
        <Image src={t.gfLogoDataUrl} style={{ width: TICKET_W * 0.34, objectFit: "contain" }} />
        {t.organizerLogoDataUrl && (
          <>
            <View style={{ width: 1, height: 28, backgroundColor: "#000", marginHorizontal: 12 }} />
            <Image src={t.organizerLogoDataUrl} style={{ width: 44, height: 44, objectFit: "contain" }} />
          </>
        )}
      </View>

      {/* Dashed separator */}
      <View style={{
        flexDirection: "row", justifyContent: "center",
        marginTop: 10, paddingHorizontal: PAD_H,
      }}>
        {Array.from({ length: 28 }).map((_, i) => (
          <View key={i} style={{ width: 4, height: 1, backgroundColor: "#999", marginHorizontal: 2 }} />
        ))}
      </View>

      {/* ── Title + pills ──────────────────────────────────────────── */}
      <Text style={{
        fontFamily: "Helvetica-Bold", fontSize: 19, color: "#0a0a0a",
        textAlign: "center", marginTop: 12, paddingHorizontal: PAD_H, lineHeight: 1.15,
      }}>
        {t.title.toUpperCase()}
      </Text>

      <Pill>PASS MULTI-MATCHS</Pill>
      <Pill size={13}>{t.priceLabel}</Pill>

      {/* ── Match rows ─────────────────────────────────────────────── */}
      {t.matches.length > 0 && (
        <View style={{ marginTop: 12, paddingHorizontal: PAD_H }}>
          {t.matches.map((m, i) => (
            <View key={i} style={{
              flexDirection: "row", alignItems: "center",
              backgroundColor: "#f2f2f2", borderRadius: 16,
              paddingVertical: 7, paddingHorizontal: 10,
              marginBottom: 6,
            }}>
              <Text style={{ flex: 1, fontFamily: "Helvetica-Bold", fontSize: 9, color: "#111" }}>
                {m.home}
              </Text>
              <View style={{ backgroundColor: "#0a0a0a", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, marginHorizontal: 6 }}>
                <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 7, color: "#fff" }}>VS</Text>
              </View>
              <Text style={{ flex: 1, fontFamily: "Helvetica-Bold", fontSize: 9, color: "#111", textAlign: "right" }}>
                {m.away}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Location pill ──────────────────────────────────────────── */}
      {t.venue && <Pill size={9}>{t.venue.toUpperCase()}</Pill>}

      {/* ── QR code — floats on the header/photo seam ─────────────── */}
      <View style={{
        position: "absolute",
        top: PHOTO_TOP - QR_FLOAT,
        left: (TICKET_W - QR_BOX) / 2,
        width: QR_BOX, height: QR_BOX,
        backgroundColor: "#fff", borderRadius: 6,
        alignItems: "center", justifyContent: "center",
        padding: 8,
      }}>
        <Image src={t.qrDataUrl} style={{ width: QR_BOX - 16, height: QR_BOX - 16 }} />
      </View>

      {/* ── Serial + seller/date — over the photo ─────────────────── */}
      <View style={{
        position: "absolute", left: 0, width: TICKET_W,
        top: PHOTO_TOP - QR_FLOAT + QR_BOX + 10,
        alignItems: "center",
      }}>
        <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9, color: "#fff", letterSpacing: 0.5 }}>
          {t.serialNumber}
        </Text>
        <Text style={{ fontSize: 7.5, color: "#fff", marginTop: 3 }}>
          {t.sellerName} &middot; {t.createdAtLabel}
        </Text>
      </View>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <View style={{
        position: "absolute", bottom: 0, left: 0, width: TICKET_W,
        backgroundColor: "#fff", paddingVertical: 10, alignItems: "center",
      }}>
        <View style={{ flexDirection: "row", justifyContent: "center", marginBottom: 6 }}>
          {Array.from({ length: 28 }).map((_, i) => (
            <View key={i} style={{ width: 4, height: 1, backgroundColor: "#999", marginHorizontal: 2 }} />
          ))}
        </View>
        <Text style={{ fontSize: 7.5, color: "#444" }}>Non remboursable</Text>
        <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 14, color: "#0a0a0a", marginTop: 2 }}>
          BON MATCH !
        </Text>
      </View>
    </View>
  );
}

export function CustomTicketsPDF({ tickets }: { tickets: CustomTicketPDFData[] }) {
  return (
    <Document>
      {tickets.map((t, i) => (
        <Page key={i} size={[TICKET_W, TICKET_H]} style={{ padding: 0 }}>
          <CustomTicketPDFView t={t} />
        </Page>
      ))}
    </Document>
  );
}
