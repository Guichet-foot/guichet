"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createUserForOdcav } from "@/lib/actions/fondateur-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Loader2, Copy, Crown } from "lucide-react";
import { toast } from "sonner";

interface Zone {
  id: string;
  name: string;
  region?: string | null;
}

interface Props {
  odcavId: string;
  odcavName: string;
  zones: Zone[];
}

const ROLE_OPTIONS = [
  { value: "admin_zone", label: "Admin Zone" },
  { value: "tresorier", label: "Trésorier" },
  { value: "c3", label: "C3" },
  { value: "caissier", label: "Caissier" },
  { value: "portier", label: "Portier" },
] as const;

type OdcavUserRole = "admin_zone" | "tresorier" | "c3" | "caissier" | "portier";

export function CreateUserButton({ odcavId, odcavName, zones }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const [role, setRole] = useState<OdcavUserRole>("admin_zone");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [zoneId, setZoneId] = useState<string>("none");
  const [isPresident, setIsPresident] = useState(false);

  function resetForm() {
    setRole("admin_zone");
    setFullName("");
    setEmail("");
    setPhone("");
    setZoneId("none");
    setIsPresident(false);
    setTempPassword(null);
  }

  async function handleSubmit() {
    if (!email.trim() || !fullName.trim()) {
      toast.error("Remplissez le nom et l'email");
      return;
    }
    if (role === "admin_zone" && zoneId === "none") {
      toast.error("Sélectionnez une zone pour l'Admin Zone");
      return;
    }

    setLoading(true);
    const result = await createUserForOdcav(odcavId, {
      email,
      fullName,
      phone,
      role,
      zoneId: role === "admin_zone" ? (zoneId === "none" ? null : zoneId) : null,
      isPresident: role === "admin_zone" ? isPresident : false,
    });
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      setTempPassword(result.password!);
      toast.success("Compte créé");
      router.refresh();
    }
  }

  return (
    <>
      <Button size="sm" className="bg-brand hover:bg-brand/90" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-1" />
        Créer un utilisateur
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {tempPassword ? "Compte créé" : `Nouveau compte — ${odcavName}`}
            </DialogTitle>
          </DialogHeader>

          {tempPassword ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Mot de passe temporaire :</p>
              <div className="flex items-center gap-2 bg-muted p-3 rounded-lg border">
                <code className="text-lg font-bold flex-1">{tempPassword}</code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { navigator.clipboard.writeText(tempPassword!); toast.success("Copié"); }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-destructive">Ce mot de passe ne sera plus affiché.</p>
              <Button
                type="button"
                className="w-full"
                onClick={() => { resetForm(); setOpen(false); }}
              >
                Fermer
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Role */}
              <div className="space-y-2">
                <Label>Rôle</Label>
                <Select value={role} onValueChange={(v) => { setRole((v ?? "admin_zone") as OdcavUserRole); setZoneId("none"); setIsPresident(false); }}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Zone selector — only for admin_zone */}
              {role === "admin_zone" && (
                <div className="space-y-3 border border-brand/20 bg-brand/5 rounded-xl p-4">
                  <div className="space-y-2">
                    <Label>Zone assignée</Label>
                    {zones.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Aucune zone disponible — créez d&apos;abord une zone</p>
                    ) : (
                      <Select value={zoneId} onValueChange={(v) => setZoneId(v ?? "none")}>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Sélectionner une zone" />
                        </SelectTrigger>
                        <SelectContent>
                          {zones.map((z) => (
                            <SelectItem key={z.id} value={z.id}>
                              {z.name}{z.region ? ` — ${z.region}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm flex items-center gap-1.5">
                        <Crown className="h-3.5 w-3.5 text-amber-500" />
                        Président de zone
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">Accès à tous les comptes de la zone</p>
                    </div>
                    <Checkbox
                      checked={isPresident}
                      onCheckedChange={(c) => setIsPresident(c === true)}
                    />
                  </div>
                </div>
              )}

              {/* Name */}
              <div className="space-y-2">
                <Label>Nom complet</Label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Prénom Nom"
                  className="h-11"
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemple.com"
                  className="h-11"
                />
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label>Téléphone <span className="text-muted-foreground">(optionnel)</span></Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+221 77 000 00 00"
                  className="h-11"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                >
                  Annuler
                </Button>
                <Button
                  type="button"
                  className="flex-1 bg-brand hover:bg-brand/90"
                  onClick={handleSubmit}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Créer le compte"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
