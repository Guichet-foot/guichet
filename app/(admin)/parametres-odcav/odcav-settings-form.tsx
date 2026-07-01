"use client";

import { useState } from "react";
import { updateOdcavSettings } from "@/lib/actions/odcav-actions";
import type { OdcavSettings, OdcavMember } from "@/lib/actions/odcav-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Plus, Save, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

interface OdcavSettingsFormProps {
  initialData: OdcavSettings;
}

export function OdcavSettingsForm({ initialData }: OdcavSettingsFormProps) {
  const [loading, setLoading] = useState(false);
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
      toast.success("Paramètres ODCAV enregistrés");
    }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      {/* Identité */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Identité de l&apos;ODCAV</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nom de l&apos;ODCAV</Label>
            <Input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="ODCAV de Thiès"
            />
          </div>
          <div className="space-y-2">
            <Label>Logo (URL de l&apos;image)</Label>
            <Input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://exemple.com/logo-odcav.png"
            />
            {logoUrl && (
              <div className="mt-2 p-3 bg-muted rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoUrl}
                  alt="Aperçu logo ODCAV"
                  className="h-16 w-auto object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            )}
          </div>
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
        disabled={loading}
        className="w-full h-12 bg-brand hover:bg-brand/90"
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            <Save className="h-5 w-5 mr-2" />
            Enregistrer les paramètres ODCAV
          </>
        )}
      </Button>
    </div>
  );
}
