"use client";

import { useState } from "react";
import { updateZoneSettings } from "@/lib/actions/zone-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Plus, X, Save, UserPlus } from "lucide-react";
import { toast } from "sonner";
import type { ZoneMember } from "@/lib/types";

interface ZoneSettingsFormProps {
  zoneId: string;
  initialData: {
    name: string;
    region: string;
    logo: string;
    president: string;
    members: ZoneMember[];
    odcav: string;
    orcav: string;
    oncav: string;
  };
}

export function ZoneSettingsForm({ zoneId, initialData }: ZoneSettingsFormProps) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(initialData.name);
  const [region, setRegion] = useState(initialData.region);
  const [logo, setLogo] = useState(initialData.logo);
  const [president, setPresident] = useState(initialData.president);
  const [members, setMembers] = useState<ZoneMember[]>(
    initialData.members.length > 0
      ? initialData.members
      : [{ name: "", poste: "", phone: "" }]
  );
  const [odcav, setOdcav] = useState(initialData.odcav);
  const [orcav, setOrcav] = useState(initialData.orcav);
  const [oncav, setOncav] = useState(initialData.oncav);

  function addMember() {
    setMembers([...members, { name: "", poste: "", phone: "" }]);
  }

  function removeMember(index: number) {
    setMembers(members.filter((_, i) => i !== index));
  }

  function updateMember(index: number, field: keyof ZoneMember, value: string) {
    const updated = [...members];
    updated[index] = { ...updated[index], [field]: value };
    setMembers(updated);
  }

  async function handleSubmit() {
    setLoading(true);
    const result = await updateZoneSettings(zoneId, {
      name,
      region,
      logo,
      president,
      members,
      odcav,
      orcav,
      oncav,
    });
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Paramètres enregistrés");
    }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Informations générales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nom de la zone</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Zone Mbour" />
          </div>
          <div className="space-y-2">
            <Label>Région</Label>
            <Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Thiès" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Organisation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Président de la zone</Label>
            <Input value={president} onChange={(e) => setPresident(e.target.value)} placeholder="Nom du président" />
          </div>
          <div className="space-y-2">
            <Label>ODCAV</Label>
            <Input value={odcav} onChange={(e) => setOdcav(e.target.value)} placeholder="ODCAV de rattachement" />
          </div>
          <div className="space-y-2">
            <Label>ORCAV</Label>
            <Input value={orcav} onChange={(e) => setOrcav(e.target.value)} placeholder="ORCAV" />
          </div>
          <div className="space-y-2">
            <Label>ONCAV</Label>
            <Input value={oncav} onChange={(e) => setOncav(e.target.value)} placeholder="ONCAV" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Membres de la zone</CardTitle>
            <Button type="button" variant="ghost" size="sm" onClick={addMember} className="text-brand">
              <UserPlus className="h-4 w-4 mr-1" />
              Ajouter
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {members.map((member, i) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Input
                  value={member.name}
                  onChange={(e) => updateMember(i, "name", e.target.value)}
                  placeholder="Nom"
                />
                <Input
                  value={member.poste}
                  onChange={(e) => updateMember(i, "poste", e.target.value)}
                  placeholder="Poste"
                />
                <Input
                  value={member.phone}
                  onChange={(e) => updateMember(i, "phone", e.target.value)}
                  placeholder="Téléphone"
                />
              </div>
              {members.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeMember(i)}
                  className="text-danger shrink-0 mt-0.5"
                >
                  <X className="h-4 w-4" />
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
            Enregistrer les paramètres
          </>
        )}
      </Button>
    </div>
  );
}
