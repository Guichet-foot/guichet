"use client";

import { useState, useRef, useEffect } from "react";
import { createAccessCard, getZoneTeamsForCard, uploadCardPhoto } from "@/lib/actions/carte-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, Loader2, Upload, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const CARD_TYPES = [
  { value: "zone",      label: "Zone",        paid: false },
  { value: "delegue",   label: "Délégué",     paid: false },
  { value: "vendeur",   label: "Vendeurs",    paid: true  },
  { value: "spectateur", label: "Spectateurs", paid: true  },
];

interface CardFormProps {
  zones: { id: string; name: string }[];
  defaultZoneId: string;
  defaultZoneName: string;
  isSuperAdmin: boolean;
  initialTeams: { id: string; name: string }[];
}

export function CardForm({
  zones,
  defaultZoneId,
  defaultZoneName,
  isSuperAdmin,
  initialTeams,
}: CardFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [zoneId, setZoneId] = useState(defaultZoneId);
  const [zoneName, setZoneName] = useState(defaultZoneName);
  const [poste, setPoste] = useState("");
  const [cardType, setCardType] = useState("zone");
  const [price, setPrice] = useState("");
  const [saison, setSaison] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    return now.getMonth() + 1 >= 8 ? `${y} - ${y + 1}` : `${y - 1} - ${y}`;
  });
  const [ascMode, setAscMode] = useState<"list" | "manual">("list");
  const [ascSelected, setAscSelected] = useState("");
  const [ascManual, setAscManual] = useState("");
  const [teams, setTeams] = useState(initialTeams);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const isPaidType = CARD_TYPES.find((t) => t.value === cardType)?.paid ?? false;
  const hasPoste = !isPaidType; // Zone et Délégué ont un poste, pas les Vendeurs/Spectateurs

  useEffect(() => {
    if (!isSuperAdmin || !zoneId) return;
    getZoneTeamsForCard(zoneId).then(setTeams);
    setAscSelected("");
  }, [zoneId, isSuperAdmin]);

  useEffect(() => {
    if (!isPaidType) setPrice("");
    if (isPaidType) setPoste(""); // pas de poste pour vendeur/spectateur
  }, [isPaidType]);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La photo ne doit pas dépasser 5 Mo");
      return;
    }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function removePhoto() {
    setPhotoFile(null);
    setPhotoPreview(null);
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

    let photoUrl: string | undefined;
    if (photoFile) {
      const fd = new FormData();
      fd.append("photo", photoFile);
      const uploadResult = await uploadCardPhoto(fd);
      if (uploadResult.error) {
        toast.error("Erreur upload photo : " + uploadResult.error);
        setLoading(false);
        return;
      }
      photoUrl = uploadResult.url;
    }

    const ascName = ascMode === "manual" ? ascManual.trim() : ascSelected;

    const result = await createAccessCard({
      full_name: fullName.trim(),
      phone: phone.trim(),
      zone_id: zoneId,
      zone_name: zoneName,
      poste: poste.trim(),
      saison: saison.trim() || undefined,
      asc_name: ascName || undefined,
      photo_url: photoUrl,
      card_type: cardType,
      price: isPaidType && price ? parseInt(price) : null,
    });

    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    setDone(true);
    toast.success("Carte créée avec succès !");
    setTimeout(() => {
      router.push(`/cartes/${result.card!.id}`);
    }, 1000);
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <p className="font-semibold text-green-800 text-lg">Carte créée !</p>
        <p className="text-sm text-muted-foreground">Redirection vers la carte…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Photo upload */}
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

      {/* Identity + card type fields */}
      <Card>
        <CardContent className="pt-5 pb-5 space-y-4">
          {/* Type de carte */}
          <div className="space-y-1.5">
            <Label htmlFor="cardType">Type de carte *</Label>
            <select
              id="cardType"
              value={cardType}
              onChange={(e) => setCardType(e.target.value)}
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
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)}
              placeholder="ex : Abdou Ka" required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">Téléphone *</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="+221 77 776 25 22" required />
          </div>

          {/* Zone selector (super_admin only) */}
          {isSuperAdmin && (
            <div className="space-y-1.5">
              <Label htmlFor="zone">Zone *</Label>
              <select
                id="zone"
                value={zoneId}
                onChange={(e) => {
                  const z = zones.find((z) => z.id === e.target.value);
                  setZoneId(e.target.value);
                  setZoneName(z?.name || "");
                }}
                required
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Sélectionner une zone…</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>{z.name}</option>
                ))}
              </select>
            </div>
          )}

          {hasPoste && (
            <div className="space-y-1.5">
              <Label htmlFor="poste">Poste *</Label>
              <Input id="poste" value={poste} onChange={(e) => setPoste(e.target.value)}
                placeholder="ex : Secrétaire Général" required />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="saison">Saison</Label>
            <Input id="saison" value={saison} onChange={(e) => setSaison(e.target.value)}
              placeholder="ex : 2025 - 2026" />
          </div>

          {/* ASC field */}
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

      <Button type="submit" disabled={loading}
        className="w-full h-12 bg-green-700 hover:bg-green-800 text-white font-semibold">
        {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Création en cours…</> : "Créer la carte"}
      </Button>
    </form>
  );
}
