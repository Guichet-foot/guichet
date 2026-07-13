"use client";

import { useRef, useState } from "react";
import { updateOdcavSettings } from "@/lib/actions/odcav-actions";
import type { OdcavSettings, OdcavMember } from "@/lib/actions/odcav-actions";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Plus, Save, Trash2, Upload, Users, X } from "lucide-react";
import { toast } from "sonner";

interface OdcavSettingsFormProps {
  initialData: OdcavSettings;
  showLogo?: boolean;
  entityLabel?: string; // "ODCAV" by default, use "ASC" for C3 pages
}

export function OdcavSettingsForm({ initialData, showLogo = true, entityLabel = "ODCAV" }: OdcavSettingsFormProps) {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState(initialData.logoUrl);
  const [nom, setNom] = useState(initialData.nom);
  const [adresse, setAdresse] = useState(initialData.adresse);
  const [president, setPresident] = useState(initialData.president);
  const [telephone, setTelephone] = useState(initialData.telephone);
  const [email, setEmail] = useState(initialData.email);
  const [membres, setMembres] = useState<OdcavMember[]>(
    initialData.membres.length > 0
      ? initialData.membres
      : [{ name: "", poste: "" }]
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 2 * 1024 * 1024; // 2 MB
    if (file.size > maxSize) {
      toast.error("Le logo ne doit pas dépasser 2 Mo");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez sélectionner une image (PNG, JPG, SVG...)");
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() || "png";
      const fileName = `odcav-logo.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("odcav-assets")
        .upload(fileName, file, { upsert: true, contentType: file.type });

      if (uploadError) {
        toast.error(`Erreur upload : ${uploadError.message}`);
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("odcav-assets")
        .getPublicUrl(fileName);

      // Cache-bust pour forcer le rechargement de l'aperçu
      setLogoUrl(`${publicUrl}?t=${Date.now()}`);
      toast.success("Logo uploadé avec succès");
    } catch {
      toast.error("Erreur lors de l'upload");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemoveLogo() {
    try {
      const supabase = createClient();
      // Essaie de supprimer les deux extensions courantes
      const ext = logoUrl?.split("odcav-logo.").pop()?.split("?")[0] || "png";
      await supabase.storage.from("odcav-assets").remove([`odcav-logo.${ext}`]);
    } catch {}
    setLogoUrl("");
  }

  function addMembre() {
    setMembres([...membres, { name: "", poste: "" }]);
  }

  function removeMembre(index: number) {
    setMembres(membres.filter((_, i) => i !== index));
  }

  function updateMembre(index: number, field: keyof OdcavMember, value: string) {
    const updated = [...membres];
    updated[index] = { ...updated[index], [field]: value };
    setMembres(updated);
  }

  async function handleSubmit() {
    setLoading(true);
    const result = await updateOdcavSettings({
      logoUrl,
      nom,
      adresse,
      president,
      telephone,
      email,
      membres: membres.filter((m) => m.name.trim() !== ""),
    });
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Paramètres ${entityLabel} enregistrés`);
    }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      {/* Identité */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Identité de l&apos;{entityLabel}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nom de l&apos;{entityLabel}</Label>
            <Input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder={entityLabel === "ODCAV" ? "ODCAV de Thiès" : "Nom de votre ASC"}
            />
          </div>

          {/* Logo upload */}
          {showLogo && <div className="space-y-2">
            <Label>Logo</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoUpload}
            />

            {logoUrl ? (
              <div className="flex items-center gap-4 p-3 bg-muted rounded-lg border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoUrl}
                  alt={`Logo ${entityLabel}`}
                  className="h-16 w-auto object-contain rounded"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Changer le logo
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveLogo}
                    className="text-danger hover:text-danger"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Supprimer
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed border-border rounded-lg hover:border-brand/40 hover:bg-brand/5 transition-colors"
              >
                {uploading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-brand" />
                ) : (
                  <Upload className="h-8 w-8 text-muted-foreground" />
                )}
                <span className="text-sm text-muted-foreground">
                  {uploading ? "Upload en cours..." : "Cliquer pour choisir un logo"}
                </span>
                <span className="text-xs text-muted-foreground">PNG, JPG, SVG — max 2 Mo</span>
              </button>
            )}
          </div>}
        </CardContent>
      </Card>

      {/* Coordonnées */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Coordonnées</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Adresse</Label>
            <Input
              value={adresse}
              onChange={(e) => setAdresse(e.target.value)}
              placeholder="Quartier Médina, Thiès"
            />
          </div>
          <div className="space-y-2">
            <Label>Président</Label>
            <Input
              value={president}
              onChange={(e) => setPresident(e.target.value)}
              placeholder="Nom du président"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Téléphone</Label>
              <Input
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="+221 77 000 00 00"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@odcav.sn"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Membres */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-brand" />
              <CardTitle className="text-lg">Membres du bureau</CardTitle>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={addMembre} className="text-brand">
              <Plus className="h-4 w-4 mr-1" />
              Ajouter
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {membres.map((membre, i) => (
            <div key={i} className="flex gap-2 items-center">
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  value={membre.name}
                  onChange={(e) => updateMembre(i, "name", e.target.value)}
                  placeholder="Nom complet"
                />
                <Input
                  value={membre.poste}
                  onChange={(e) => updateMembre(i, "poste", e.target.value)}
                  placeholder="Poste / Fonction"
                />
              </div>
              {membres.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeMembre(i)}
                  className="text-danger shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Button
        type="button"
        onClick={handleSubmit}
        disabled={loading || uploading}
        className="w-full h-12 bg-brand hover:bg-brand/90"
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            <Save className="h-5 w-5 mr-2" />
            Enregistrer les paramètres {entityLabel}
          </>
        )}
      </Button>
    </div>
  );
}
