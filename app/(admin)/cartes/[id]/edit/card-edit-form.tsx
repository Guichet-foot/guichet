"use client";

import { useState, useRef, useEffect } from "react";
import { updateAccessCard, getZoneTeamsForCard, deleteAccessCard } from "@/lib/actions/carte-actions";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Camera, Loader2, Upload, X, CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { AccessCard, CardType } from "@/lib/types";

const CARD_TYPES = [
  { value: "zone",       label: "Zone",        paid: false },
  { value: "delegue",    label: "Délégué",     paid: false },
  { value: "vendeur",    label: "Vendeurs",    paid: true  },
  { value: "spectateur", label: "Spectateurs", paid: true  },
];

interface CardEditFormProps {
  card: AccessCard;
  zones: { id: string; name: string }[];
  isSuperAdmin: boolean;
  initialTeams: { id: string; name: string }[];
}

export function CardEditForm({ card, zones, isSuperAdmin, initialTeams }: CardEditFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(card.full_name);
  const [phone, setPhone] = useState(card.phone);
  const [zoneId, setZoneId] = useState(card.zone_id);
  const [zoneName, setZoneName] = useState(card.zone_name);
  const [poste, setPoste] = useState(card.poste);
  const [cardType, setCardType] = useState<CardType>(card.card_type || "zone");
  const [price, setPrice] = useState(card.price != null ? String(card.price) : "");
  const [saison, setSaison] = useState(card.saison || "");
  const [ascMode, setAscMode] = useState<"list" | "manual">(
    card.asc_name ? "manual" : "list"
  );
  const [ascSelected, setAscSelected] = useState(
    initialTeams.some((t) => t.name === card.asc_name) ? (card.asc_name || "") : ""
  );
  const [ascManual, setAscManual] = useState(card.asc_name || "");
  const [teams, setTeams] = useState(initialTeams);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(card.photo_url);
  const [photoRemoved, setPhotoRemoved] = useState(false);

  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isPaidType = CARD_TYPES.find((t) => t.value === cardType)?.paid ?? false;
  const hasPoste = !isPaidType;

  useEffect(() => {
    if (!isSuperAdmin || !zoneId) return;
    getZoneTeamsForCard(zoneId).then(setTeams);
    setAscSelected("");
  }, [zoneId, isSuperAdmin]);

  useEffect(() => {
    if (!isPaidType) setPrice("");
    if (isPaidType) setPoste("");
  }, [isPaidType]);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La photo ne doit pas dépasser 5 Mo");
      return;
    }
    setPhotoFile(file);
    setPhotoRemoved(false);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function removePhoto() {
    setPhotoFile(null);
    setPhotoPreview(null);
    setPhotoRemoved(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim() || !zoneId) {
      toast.error("Remplissez tous les champs obligatoires");
      return;
    }
    if (hasPoste && !poste.trim()) {
      toast.error("Remplissez tous les champs obligatoires");
      return;
    }
    if (isPaidType && (!price || parseInt(price) <= 0)) {
      toast.error("Saisissez le montant de la carte");
      return;
    }

    setLoading(true);

    let finalPhotoUrl: string | null = card.photo_url ?? null;
    if (photoFile) {
      const supabase = createClient();
      const ext = photoFile.name.split(".").pop() || "jpg";
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("card-photos")
        .upload(path, photoFile, { contentType: photoFile.type });
      if (uploadError) {
        toast.error("Erreur upload photo : " + uploadError.message);
        setLoading(false);
        return;
      }
      const { data: { publicUrl } } = supabase.storage.from("card-photos").getPublicUrl(path);
      finalPhotoUrl = publicUrl;
    } else if (photoRemoved) {
      finalPhotoUrl = null;
    }

    const ascName = ascMode === "manual" ? ascManual.trim() : ascSelected;

    const result = await updateAccessCard(card.id, {
      full_name: fullName.trim(),
      phone: phone.trim(),
      zone_id: zoneId,
      zone_name: zoneName,
      poste: poste.trim(),
      saison: saison.trim() || undefined,
      asc_name: ascName || null,
      photo_url: finalPhotoUrl,
      card_type: cardType,
      price: isPaidType && price ? parseInt(price) : null,
    });

    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    setDone(true);
    toast.success("Carte mise à jour !");
    setTimeout(() => router.push("/cartes"), 900);
  }

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteAccessCard(card.id);
    setDeleting(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Carte supprimée");
    setDeleteOpen(false);
    router.push("/cartes");
    router.refresh();
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <p className="font-semibold text-green-800 text-lg">Carte mise à jour !</p>
        <p className="text-sm text-muted-foreground">Retour à la liste…</p>
      </div>
    );
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Photo */}
        <Card>
          <CardContent className="pt-5 pb-5">
            <Label className="mb-3 block">Photo de profil</Label>
            <div className="flex items-center gap-4">
              <div
                className="w-24 h-24 rounded-full border-2 border-dashed border-green-300 flex items-center justify-center overflow-hidden bg-green-50 shrink-0 cursor-pointer hover:border-green-500 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {photoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoPreview} alt="Aperçu" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="h-8 w-8 text-green-400" />
                )}
              </div>
              <div className="space-y-2">
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  {photoPreview ? "Changer la photo" : "Choisir une photo"}
                </Button>
                {photoPreview && (
                  <Button type="button" variant="ghost" size="sm" onClick={removePhoto}
                    className="text-destructive hover:text-destructive">
                    <X className="h-4 w-4 mr-1" />Supprimer
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">JPG, PNG · max 5 Mo</p>
              </div>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                className="hidden" onChange={handlePhotoChange} />
            </div>
          </CardContent>
        </Card>

        {/* Fields */}
        <Card>
          <CardContent className="pt-5 pb-5 space-y-4">
            {/* Type de carte */}
            <div className="space-y-1.5">
              <Label htmlFor="cardType">Type de carte *</Label>
              <select
                id="cardType"
                value={cardType}
                onChange={(e) => setCardType(e.target.value as CardType)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {CARD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}{t.paid ? " (payant)" : " (gratuit)"}
                  </option>
                ))}
              </select>
            </div>

            {/* Montant (only for paid types) */}
            {isPaidType && (
              <div className="space-y-1.5">
                <Label htmlFor="price">Montant (FCFA) *</Label>
                <Input
                  id="price"
                  type="number"
                  min={0}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="ex : 20000"
                  required
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="fullName">Nom complet *</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">Téléphone *</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>

            {isSuperAdmin && (
              <div className="space-y-1.5">
                <Label htmlFor="zone">Zone *</Label>
                <select id="zone" value={zoneId}
                  onChange={(e) => {
                    const z = zones.find((z) => z.id === e.target.value);
                    setZoneId(e.target.value);
                    setZoneName(z?.name || "");
                  }}
                  required
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
              </div>
            )}

            {hasPoste && (
              <div className="space-y-1.5">
                <Label htmlFor="poste">Poste *</Label>
                <Input id="poste" value={poste} onChange={(e) => setPoste(e.target.value)} required />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="saison">Saison</Label>
              <Input id="saison" value={saison} onChange={(e) => setSaison(e.target.value)}
                placeholder="ex : 2025 - 2026" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>ASC (optionnel)</Label>
                <button type="button" className="text-xs text-green-700 underline"
                  onClick={() => setAscMode(ascMode === "list" ? "manual" : "list")}>
                  {ascMode === "list" ? "Saisir manuellement" : "Choisir dans la liste"}
                </button>
              </div>
              {ascMode === "list" ? (
                <select value={ascSelected} onChange={(e) => setAscSelected(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="">Aucune ASC</option>
                  {teams.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
                </select>
              ) : (
                <Input value={ascManual} onChange={(e) => setAscManual(e.target.value)}
                  placeholder="Nom de l'ASC…" />
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={loading}
            className="flex-1 h-12 bg-green-700 hover:bg-green-800 text-white font-semibold">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Enregistrement…</> : "Enregistrer les modifications"}
          </Button>
          <Button type="button" variant="outline" onClick={() => setDeleteOpen(true)}
            className="h-12 text-destructive border-destructive/30 hover:bg-destructive/5">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </form>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer la carte ?</DialogTitle>
            <DialogDescription>
              La carte de <strong>{card.full_name}</strong> sera définitivement supprimée.
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
