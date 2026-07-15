"use client";

import { useState, useRef } from "react";
import { createAccessCard } from "@/lib/actions/carte-actions";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, Loader2, Upload, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const ODCAV_FONCTIONS = [
  "Président ODCAV",
  "Vice-Président ODCAV",
  "Secrétaire Général",
  "Secrétaire Général Adjoint",
  "Trésorier Général",
  "Trésorier Général Adjoint",
  "Commissaire aux Comptes",
  "Membre du Bureau",
  "Responsable Technique",
  "Délégué ODCAV",
];

export function OdcavCardForm({ successRedirect }: { successRedirect?: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [fonctionMode, setFonctionMode] = useState<"list" | "manual">("list");
  const [fonctionSelected, setFonctionSelected] = useState("");
  const [fonctionManual, setFonctionManual] = useState("");
  const [saison, setSaison] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    return now.getMonth() + 1 >= 8 ? `${y} - ${y + 1}` : `${y - 1} - ${y}`;
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

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
    const fonction = fonctionMode === "manual" ? fonctionManual.trim() : fonctionSelected;
    if (!fullName.trim() || !phone.trim() || !fonction) {
      toast.error("Remplissez tous les champs obligatoires");
      return;
    }

    setLoading(true);

    let photoUrl: string | undefined;
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
      photoUrl = publicUrl;
    }

    const result = await createAccessCard({
      full_name: fullName.trim(),
      phone: phone.trim(),
      zone_id: null,
      zone_name: "ODCAV",
      poste: fonction,
      saison: saison.trim() || undefined,
      photo_url: photoUrl,
      card_type: "odcav",
      price: null,
    });

    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    setDone(true);
    toast.success("Carte ODCAV créée !");
    setTimeout(() => {
      router.push(successRedirect ?? `/cartes/${result.card!.id}`);
    }, 1000);
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-purple-600" />
        </div>
        <p className="font-semibold text-purple-800 text-lg">Carte ODCAV créée !</p>
        <p className="text-sm text-muted-foreground">Redirection vers la carte…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Photo */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <Label className="mb-3 block">Photo de profil</Label>
          <div className="flex items-center gap-4">
            <div
              className="w-24 h-24 rounded-full border-2 border-dashed border-purple-300 flex items-center justify-center overflow-hidden bg-purple-50 shrink-0 cursor-pointer hover:border-purple-500 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoPreview} alt="Aperçu" className="w-full h-full object-cover" />
              ) : (
                <Camera className="h-8 w-8 text-purple-400" />
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

      {/* Champs */}
      <Card>
        <CardContent className="pt-5 pb-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Nom complet *</Label>
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)}
              placeholder="ex : Mamadou Diallo" required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">Téléphone *</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="+221 77 000 00 00" required />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Fonction *</Label>
              <button type="button" className="text-xs text-purple-700 underline"
                onClick={() => setFonctionMode(fonctionMode === "list" ? "manual" : "list")}>
                {fonctionMode === "list" ? "Saisir manuellement" : "Choisir dans la liste"}
              </button>
            </div>
            {fonctionMode === "list" ? (
              <select
                value={fonctionSelected}
                onChange={(e) => setFonctionSelected(e.target.value)}
                required
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Sélectionner une fonction…</option>
                {ODCAV_FONCTIONS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            ) : (
              <Input value={fonctionManual} onChange={(e) => setFonctionManual(e.target.value)}
                placeholder="ex : Chargé de Communication" required />
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="saison">Saison</Label>
            <Input id="saison" value={saison} onChange={(e) => setSaison(e.target.value)}
              placeholder="ex : 2025 - 2026" />
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={loading}
        className="w-full h-12 bg-purple-700 hover:bg-purple-800 text-white font-semibold">
        {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Création en cours…</> : "Créer la carte ODCAV"}
      </Button>
    </form>
  );
}
