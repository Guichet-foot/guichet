"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { deleteAccessCard } from "@/lib/actions/carte-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  User,
  Phone,
  MapPin,
  Briefcase,
  Shield,
  Download,
  Pencil,
  ShoppingCart,
  Users,
  TrendingUp,
  Wallet,
  CreditCard,
  Tag,
  FileDown,
  Loader2,
  Search,
  CheckSquare,
  Square,
  Clock,
  CalendarRange,
  X,
  Trash2,
} from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { AccessCard } from "@/lib/types";
import { formatFCFA } from "@/lib/format";

export interface CardWithQR {
  card: AccessCard;
  qrDataUrl: string;
}

type Tab = "zone_delegue" | "vendeur" | "spectateur" | "personne_ressource";

const TABS: { id: Tab; label: string }[] = [
  { id: "zone_delegue",       label: "Zone et Délégué" },
  { id: "vendeur",            label: "Vendeurs" },
  { id: "spectateur",         label: "Spectateurs" },
  { id: "personne_ressource", label: "Pers. Ressource" },
];

const TYPE_LABELS: Record<string, string> = {
  zone: "ZONE",
  delegue: "DÉLÉGUÉ",
  vendeur: "VENDEUR",
  spectateur: "SPECTATEUR",
  odcav: "ODCAV",
  personne_ressource: "PERS. RESSOURCE",
};

const TYPE_COLORS: Record<string, string> = {
  zone: "#166534",
  delegue: "#1D4ED8",
  vendeur: "#B45309",
  spectateur: "#6D28D9",
  odcav: "#7C3AED",
  personne_ressource: "#475569",
};

const TYPE_BG: Record<string, string> = {
  zone: "#f0fdf4",
  delegue: "#eff6ff",
  vendeur: "#fffbeb",
  spectateur: "#faf5ff",
  odcav: "#fdf4ff",
  personne_ressource: "#f8fafc",
};

function getSaison(card: AccessCard): string {
  if (card.saison) return card.saison;
  const d = new Date(card.created_at);
  const y = d.getFullYear();
  return d.getMonth() + 1 >= 8 ? `${y} - ${y + 1}` : `${y - 1} - ${y}`;
}

/** Card design — scales via container queries (cqi). */
function CardDesign({ card, qrDataUrl, zoneLogo }: { card: AccessCard; qrDataUrl: string; zoneLogo?: string }) {
  const saison = getSaison(card);
  const type = card.card_type || "zone";
  const price = card.price;

  const isOdcavCard = type === "odcav";
  const isPaidCard = type === "vendeur" || type === "spectateur";
  const isPersonneRessource = type === "personne_ressource";

  const typeColor = TYPE_COLORS[type] || "#166534";
  const typeBg = TYPE_BG[type] || "#f0fdf4";

  const badgeText = type === "zone" && card.zone_name
    ? card.zone_name.toUpperCase()
    : (TYPE_LABELS[type] || "ZONE");

  const rows: { Icon: React.ElementType; label: string; value: string | null | undefined }[] = [
    { Icon: User,  label: "NOM COMPLET", value: card.full_name },
    { Icon: Phone, label: "TÉLÉPHONE",   value: card.phone },
    ...(!isPaidCard && !isOdcavCard && !isPersonneRessource ? [{ Icon: MapPin, label: "ZONE", value: card.zone_name }] : []),
    ...(!isPaidCard ? [{ Icon: Briefcase, label: isOdcavCard ? "FONCTION" : "POSTE", value: card.poste }] : []),
    ...(!isOdcavCard && card.asc_name ? [{ Icon: Shield, label: "ASC", value: card.asc_name }] : []),
    ...(price != null && price > 0 && !isPersonneRessource
      ? [{ Icon: Tag, label: "MONTANT", value: `${price.toLocaleString("fr-FR")} FCFA` }]
      : []),
  ];

  return (
    <div
      className="relative w-full rounded-xl overflow-hidden shadow-md"
      style={{ aspectRatio: "85.6 / 54", border: `2.5px solid ${typeColor}`, backgroundColor: typeBg }}
    >
      {/* Header */}
      <div
        className="absolute inset-x-0 top-0 flex items-center"
        style={{ height: "30%", padding: "1% 2%", backgroundColor: typeBg, borderBottom: `1px solid ${typeColor}` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={zoneLogo || "/logoodcavdes.png"}
          alt="Logo"
          style={{ height: "80%", width: "auto", objectFit: "contain", flexShrink: 0 }}
        />
        <div style={{ flex: 1, textAlign: "center", paddingRight: "25%" }}>
          <p
            className="font-black leading-tight"
            style={{ fontSize: "5.5cqi", lineHeight: 1.05, color: typeColor }}
          >
            CARTE D&apos;ACCÈS
          </p>
          <p
            className="font-semibold"
            style={{ fontSize: "2.1cqi", marginTop: "0.2cqi", color: typeColor }}
          >
            — SAISON {saison} —
          </p>
          {!isPersonneRessource && (
            <div style={{ marginTop: "0.5cqi", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{
                backgroundColor: typeColor,
                color: "white",
                fontSize: "1.6cqi",
                padding: "0.2cqi 1.3cqi",
                borderRadius: "99px",
                fontWeight: 800,
                letterSpacing: "0.06em",
                display: "inline-block",
              }}>
                {badgeText}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="absolute inset-x-0 bottom-0 flex" style={{ top: "30%" }}>
        {/* Info rows */}
        <div className="flex flex-col border-r border-gray-200" style={{ width: "65%" }}>
          {rows.map(({ Icon, label, value }, i) => (
            <div
              key={label}
              className="flex items-center"
              style={{
                flex: 1,
                borderBottom: i < rows.length - 1 ? "0.5px solid #e5e7eb" : "none",
                padding: "0 2%",
                gap: "2%",
              }}
            >
              <div
                className="flex items-center justify-center rounded shrink-0"
                style={{ width: "5.5cqi", height: "5.5cqi", backgroundColor: typeColor }}
              >
                <Icon style={{ width: "58%", height: "58%", color: "white" }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <p
                  className="font-bold uppercase leading-none"
                  style={{ fontSize: "1.6cqi", letterSpacing: "0.03em", color: typeColor }}
                >
                  {label}
                </p>
                <p
                  className="font-bold text-gray-900 truncate"
                  style={{ fontSize: "2.5cqi", marginTop: "0.2cqi" }}
                >
                  {value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* QR */}
        <div
          className="flex items-end justify-center"
          style={{ width: "35%", paddingBottom: "2%" }}
        >
          <div style={{ width: "84%", padding: "1%", border: `1px solid ${typeColor}` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt="QR"
              className="w-full block"
              style={{ imageRendering: "pixelated" } as React.CSSProperties}
            />
          </div>
        </div>
      </div>

      {/* Photo — portrait rectangle, header height + small overflow into body */}
      <div
        className="absolute overflow-hidden"
        style={{
          width: "25%",
          height: "38%",
          top: "3%",
          right: "2%",
          borderRadius: "6px",
          border: `2.5px solid ${typeColor}`,
          backgroundColor: typeBg,
        }}
      >
        {card.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.photo_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <User className="w-2/5 h-2/5" style={{ color: typeColor }} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Bulk Download Modal ────────────────────────────────────────────────────────

interface BulkDownloadModalProps {
  open: boolean;
  onClose: () => void;
  items: CardWithQR[];
  tabLabel: string;
  onDownload: (selected: CardWithQR[]) => void;
  downloading: boolean;
}

function BulkDownloadModal({ open, onClose, items, tabLabel, onDownload, downloading }: BulkDownloadModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const selectAllRef = useRef<HTMLInputElement>(null);

  // Initialise avec tout sélectionné à chaque ouverture
  useEffect(() => {
    if (open) {
      setSelectedIds(new Set(items.map((i) => i.card.id)));
      setSearch("");
    }
  }, [open, items]);

  const filtered = items.filter((i) =>
    i.card.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const allFilteredSelected = filtered.length > 0 && filtered.every((i) => selectedIds.has(i.card.id));
  const someFilteredSelected = filtered.some((i) => selectedIds.has(i.card.id));

  // Indeterminate state on "select all" checkbox
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someFilteredSelected && !allFilteredSelected;
    }
  }, [someFilteredSelected, allFilteredSelected]);

  function toggleAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filtered.forEach((i) => next.delete(i.card.id));
      } else {
        filtered.forEach((i) => next.add(i.card.id));
      }
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedItems = items.filter((i) => selectedIds.has(i.card.id));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 gap-0 flex flex-col" style={{ maxHeight: "82vh" }}>
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-4 border-b shrink-0">
          <DialogTitle className="text-base font-bold">Sélectionner les cartes à télécharger</DialogTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tabLabel} · {items.length} carte{items.length > 1 ? "s" : ""}
          </p>
        </DialogHeader>

        {/* Search */}
        <div className="px-5 py-3 border-b shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un nom…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>

        {/* Select all row */}
        <div
          className="px-5 py-2.5 border-b shrink-0 flex items-center gap-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={toggleAll}
        >
          <input
            ref={selectAllRef}
            type="checkbox"
            checked={allFilteredSelected}
            onChange={toggleAll}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 accent-green-700 cursor-pointer"
          />
          {allFilteredSelected ? (
            <CheckSquare className="h-4 w-4 text-green-700 -ml-7 pointer-events-none" style={{ display: "none" }} />
          ) : null}
          <span className="text-sm font-semibold text-foreground">
            {allFilteredSelected ? "Tout désélectionner" : "Tout sélectionner"}
          </span>
          <span className="ml-auto text-xs text-muted-foreground">
            {selectedIds.size} / {items.length} sélectionné{selectedIds.size > 1 ? "s" : ""}
          </span>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucun résultat</p>
          ) : (
            <div className="space-y-0.5">
              {filtered.map((item) => {
                const type = item.card.card_type || "zone";
                const color = TYPE_COLORS[type] || "#166534";
                const bg = TYPE_BG[type] || "#f0fdf4";
                const label = TYPE_LABELS[type] || "ZONE";
                const isSelected = selectedIds.has(item.card.id);
                return (
                  <label
                    key={item.card.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer hover:bg-muted/40 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(item.card.id)}
                      className="h-4 w-4 accent-green-700 shrink-0 cursor-pointer"
                    />
                    {/* Photo thumbnail */}
                    <div
                      className="w-8 h-8 rounded-full overflow-hidden shrink-0 flex items-center justify-center"
                      style={{ border: `1.5px solid ${color}`, backgroundColor: bg }}
                    >
                      {item.card.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.card.photo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-4 h-4" style={{ color }} />
                      )}
                    </div>
                    {/* Name */}
                    <span className="flex-1 text-sm font-medium text-foreground truncate">
                      {item.card.full_name}
                    </span>
                    {/* Type badge */}
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                      style={{ backgroundColor: color, color: "white" }}
                    >
                      {label}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t shrink-0 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={downloading}>
            Annuler
          </Button>
          <Button
            className="flex-1 bg-green-700 hover:bg-green-800 text-white"
            onClick={() => onDownload(selectedItems)}
            disabled={downloading || selectedIds.size === 0}
          >
            {downloading ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Génération…</>
            ) : (
              <><FileDown className="h-4 w-4 mr-2" />Télécharger ({selectedIds.size})</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Card grid ──────────────────────────────────────────────────────────────────

interface CartesGridProps {
  items: CardWithQR[];
  zoneLogo?: string;
  readOnly?: boolean;
}

function CartesGrid({ items, zoneLogo, readOnly }: CartesGridProps) {
  const [selected, setSelected] = useState<CardWithQR | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  function closeMain() {
    setSelected(null);
    setDeleteOpen(false);
  }

  async function handleDelete() {
    if (!selected) return;
    setDeleting(true);
    const result = await deleteAccessCard(selected.card.id);
    setDeleting(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Carte supprimée");
    closeMain();
    router.refresh();
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map((item) => (
          <button
            key={item.card.id}
            className="text-left w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-green-700 rounded-xl"
            style={{ containerType: "inline-size" }}
            onClick={() => setSelected(item)}
          >
            <div className="hover:scale-[1.015] hover:shadow-lg transition-all duration-150 rounded-xl">
              <CardDesign card={item.card} qrDataUrl={item.qrDataUrl} zoneLogo={zoneLogo} />
            </div>
          </button>
        ))}
      </div>

      {/* Card preview modal */}
      <Dialog open={!!selected && !deleteOpen} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg p-5 gap-3">
          {selected && (
            <>
              <div style={{ containerType: "inline-size" }}>
                <CardDesign card={selected.card} qrDataUrl={selected.qrDataUrl} zoneLogo={zoneLogo} />
              </div>
              {/* Creation date */}
              <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                Créée le {formatDateTime(selected.card.created_at)}
              </p>
              <div className="flex gap-2">
                {!readOnly && (
                  <Link href={`/cartes/${selected.card.id}/edit?from=${encodeURIComponent(pathname)}`} className="flex-1">
                    <Button className="w-full bg-green-700 hover:bg-green-800 text-white">
                      <Pencil className="h-4 w-4 mr-1.5" />Modifier
                    </Button>
                  </Link>
                )}
                <a href={`/api/cartes/${selected.card.id}/download`} download>
                  <Button variant="outline" className="border-green-700 text-green-700 hover:bg-green-50">
                    <Download className="h-4 w-4 mr-1.5" />Télécharger
                  </Button>
                </a>
                {!readOnly && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                    onClick={() => setDeleteOpen(true)}
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteOpen} onOpenChange={(open) => { if (!open) setDeleteOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer la carte ?</DialogTitle>
            <DialogDescription>
              La carte de <strong>{selected?.card.full_name}</strong> sera définitivement supprimée ainsi que sa photo.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Annuler
            </Button>
            <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Supprimer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Main client component ──────────────────────────────────────────────────────

export function CartesClient({ items, zoneLogo, readOnly, odcavOnly }: { items: CardWithQR[]; zoneLogo?: string; readOnly?: boolean; odcavOnly?: boolean }) {
  const [activeTab, setActiveTab] = useState<Tab>("zone_delegue");
  const [downloading, setDownloading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalItems, setModalItems] = useState<CardWithQR[]>([]);
  const [modalLabel, setModalLabel] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  async function downloadBulk(cardItems: CardWithQR[]) {
    if (cardItems.length === 0) return;
    setDownloading(true);
    try {
      const ids = cardItems.map((i) => i.card.id);
      const res = await fetch("/api/cartes/bulk-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        let detail = "";
        try { const j = await res.json(); detail = j?.error || ""; } catch { /* no-op */ }
        toast.error(`Erreur de génération PDF${detail ? ` : ${detail}` : ""}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "cartes-acces.pdf";
      a.click();
      URL.revokeObjectURL(url);
      setModalOpen(false);
      toast.success("PDF téléchargé");
    } catch (err) {
      toast.error(`Erreur réseau : ${err instanceof Error ? err.message : "inconnu"}`);
    } finally {
      setDownloading(false);
    }
  }

  function openModal(cardItems: CardWithQR[], label: string) {
    setModalItems(cardItems);
    setModalLabel(label);
    setModalOpen(true);
  }

  // ── Date filter logic (shared by all views) ───────────────────────────────
  const dateFiltered = items.filter((item) => {
    const created = new Date(item.card.created_at);
    if (dateFrom) {
      const from = new Date(dateFrom);
      from.setHours(0, 0, 0, 0);
      if (created < from) return false;
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      if (created > to) return false;
    }
    return true;
  });

  const hasDateFilter = !!dateFrom || !!dateTo;

  function DateFilterBar() {
    return (
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl border bg-muted/30">
        <CalendarRange className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium text-muted-foreground">Filtrer par date :</span>
        <div className="flex flex-wrap gap-2 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Du</span>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 text-xs w-36"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Au</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 text-xs w-36"
            />
          </div>
          {hasDateFilter && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => { setDateFrom(""); setDateTo(""); }}
            >
              <X className="h-3.5 w-3.5 mr-1" />Effacer
            </Button>
          )}
        </div>
        {hasDateFilter && (
          <span className="text-xs text-muted-foreground ml-auto">
            {dateFiltered.length} / {items.length} carte{dateFiltered.length > 1 ? "s" : ""}
          </span>
        )}
      </div>
    );
  }

  // Mode ODCAV : affichage direct sans stats/onglets zone
  if (odcavOnly) {
    return (
      <div className="space-y-4">
        <DateFilterBar />
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5 border-purple-700 text-purple-700 hover:bg-purple-50"
            onClick={() => openModal(dateFiltered, "Toutes les cartes")}
            disabled={dateFiltered.length === 0}
          >
            <FileDown className="h-3.5 w-3.5" />PDF A4 ({dateFiltered.length})
          </Button>
        </div>
        <CartesGrid items={dateFiltered} zoneLogo={zoneLogo} readOnly={readOnly} />
        <BulkDownloadModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          items={modalItems}
          tabLabel={modalLabel}
          onDownload={downloadBulk}
          downloading={downloading}
        />
      </div>
    );
  }

  const vendeurItems = dateFiltered.filter((i) => i.card.card_type === "vendeur");
  const spectateurItems = dateFiltered.filter((i) => i.card.card_type === "spectateur");
  const revenusVendeurs = vendeurItems.reduce((s, i) => s + (i.card.price || 0), 0);
  const revenusSpectateurs = spectateurItems.reduce((s, i) => s + (i.card.price || 0), 0);
  const totalRevenus = revenusVendeurs + revenusSpectateurs;

  const personneRessourceItems = dateFiltered.filter((i) => i.card.card_type === "personne_ressource");

  const filteredItems =
    activeTab === "zone_delegue"
      ? dateFiltered.filter((i) => i.card.card_type === "zone" || i.card.card_type === "delegue")
      : activeTab === "vendeur"
      ? vendeurItems
      : activeTab === "spectateur"
      ? spectateurItems
      : personneRessourceItems;

  const activeTabLabel = TABS.find((t) => t.id === activeTab)?.label ?? "";

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <CreditCard className="h-16 w-16 mb-4 opacity-20" />
        <p className="font-medium">Aucune carte créée</p>
        <p className="text-sm mt-1">Créez votre première carte d&apos;accès</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date filter */}
      <DateFilterBar />

      {/* Stats Cards */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="rounded-xl p-4 bg-green-100 border border-green-200 flex items-center justify-between">
            <div>
              <p className="text-green-800 font-bold text-sm sm:text-base leading-tight">Vendeurs</p>
              <p className="text-green-900 font-semibold text-base sm:text-lg mt-0.5">
                {vendeurItems.length} Cartes Vendeurs
              </p>
            </div>
            <ShoppingCart className="h-8 w-8 sm:h-10 sm:w-10 text-green-300 shrink-0" />
          </div>

          <div className="rounded-xl p-4 bg-indigo-100 border border-indigo-200 flex items-center justify-between">
            <div>
              <p className="text-indigo-800 font-bold text-sm sm:text-base leading-tight">Spectateurs</p>
              <p className="text-indigo-900 font-semibold text-base sm:text-lg mt-0.5">
                {spectateurItems.length} Cartes Spectateurs
              </p>
            </div>
            <Users className="h-8 w-8 sm:h-10 sm:w-10 text-indigo-300 shrink-0" />
          </div>

          <div className="col-span-2 sm:col-span-1 rounded-xl p-4 bg-green-800 flex items-center justify-between">
            <div>
              <p className="text-white font-bold text-sm sm:text-base leading-tight">REVENUS TOTAL</p>
              <p className="text-white/60 text-xs mt-0.5">Vendeurs + Spectateurs</p>
              <p className="text-white font-bold text-xl sm:text-2xl mt-1">
                {formatFCFA(totalRevenus)}
              </p>
            </div>
            <TrendingUp className="h-10 w-10 sm:h-12 sm:w-12 text-white/20 shrink-0" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl p-4 bg-amber-50 border border-amber-200 flex items-center justify-between">
            <div>
              <p className="text-amber-800 font-bold text-sm sm:text-base leading-tight">Revenus Vendeurs</p>
              <p className="text-amber-900 font-semibold text-base sm:text-lg mt-0.5">
                {formatFCFA(revenusVendeurs)}
              </p>
            </div>
            <Wallet className="h-8 w-8 sm:h-10 sm:w-10 text-amber-200 shrink-0" />
          </div>

          <div className="rounded-xl p-4 bg-pink-50 border border-pink-200 flex items-center justify-between">
            <div>
              <p className="text-pink-800 font-bold text-sm sm:text-base leading-tight">Revenus spectateurs</p>
              <p className="text-pink-900 font-semibold text-base sm:text-lg mt-0.5">
                {formatFCFA(revenusSpectateurs)}
              </p>
            </div>
            <Wallet className="h-8 w-8 sm:h-10 sm:w-10 text-pink-200 shrink-0" />
          </div>
        </div>
      </div>

      {/* Tabs + bulk download */}
      <div className="border-b border-border flex items-center justify-between">
        <div className="flex">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-green-700 text-green-700"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mb-1 mr-1 text-xs gap-1.5 border-green-700 text-green-700 hover:bg-green-50"
          onClick={() => openModal(filteredItems, activeTabLabel)}
          disabled={filteredItems.length === 0}
        >
          <FileDown className="h-3.5 w-3.5" />PDF A4 ({filteredItems.length})
        </Button>
      </div>

      {/* Grid */}
      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <CreditCard className="h-12 w-12 mb-3 opacity-20" />
          <p className="font-medium">Aucune carte dans cet onglet</p>
        </div>
      ) : (
        <CartesGrid items={filteredItems} zoneLogo={zoneLogo} readOnly={readOnly} />
      )}

      {/* Bulk download modal */}
      <BulkDownloadModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        items={modalItems}
        tabLabel={modalLabel}
        onDownload={downloadBulk}
        downloading={downloading}
      />
    </div>
  );
}
