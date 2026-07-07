"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { createUser } from "@/lib/actions/user-actions";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Copy, Loader2, Crown, Clock } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { ADMIN_MODULES } from "@/lib/constants";
import type { Zone } from "@/lib/types";

export default function NewUserPage() {
  const searchParams = useSearchParams();
  const zoneParam = searchParams.get("zone");
  const tabParam = searchParams.get("tab"); // "directs" = comptes directs tab
  const isDirectsMode = tabParam === "directs";

  const [loading, setLoading] = useState(false);
  const [zones, setZones] = useState<Zone[]>([]);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const [currentUserRole, setCurrentUserRole] = useState<string>("");
  const [currentUserIsPresident, setCurrentUserIsPresident] = useState(false);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<string>("");
  const [zoneId, setZoneId] = useState<string>(zoneParam ?? "");
  const [isPresident, setIsPresident] = useState(false);
  const [city, setCity] = useState("");
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [allModules, setAllModules] = useState(true);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [pwUnit, setPwUnit] = useState<"jamais" | "minutes" | "heures" | "24h">("jamais");
  const [pwValue, setPwValue] = useState<number>(30);

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, zone_id, is_president")
        .eq("id", user.id)
        .single();

      if (profile) {
        setCurrentUserRole(profile.role);
        setCurrentUserIsPresident(profile.is_president ?? false);
        if (profile.role === "admin_zone" && profile.zone_id) {
          setZoneId(profile.zone_id);
        }
      }

      const isOdcav = profile?.role === "super_admin" || profile?.role === "president_odcav";
      if (isOdcav) {
        const { data } = await supabase.from("zones").select("*").order("name");
        if (data) setZones(data);
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (role !== "admin_zone") setIsPresident(false);
    if (role !== "c3") { setCity(""); setSelectedZones([]); }
    if (role !== "super_admin") { setAllModules(true); setSelectedModules([]); }
    if (role !== "caissier" && role !== "portier") { setPwUnit("jamais"); setPwValue(30); }
  }, [role]);

  const isOdcavRole = currentUserRole === "super_admin" || currentUserRole === "president_odcav";

  // ── Available roles ─────────────────────────────────────────────
  const availableRoles = (() => {
    if (isOdcavRole) {
      if (isDirectsMode) {
        // Comptes directs: C3 and direct super_admin sub-accounts
        return [
          { value: "c3",         label: "Coordination C3" },
          { value: "super_admin",label: "Super Admin (accès direct)" },
        ];
      }
      // Zone-based creation (from ?zone=xxx or zone card): no C3, no super_admin
      return [
        { value: "admin_zone", label: "Admin Zone" },
        { value: "caissier",   label: "Caissier" },
        { value: "portier",    label: "Portier" },
      ];
    }
    if (currentUserRole === "admin_zone" && currentUserIsPresident) {
      return [
        { value: "admin_zone", label: "Admin Zone" },
        { value: "caissier",   label: "Caissier" },
        { value: "portier",    label: "Portier" },
      ];
    }
    return [
      { value: "caissier", label: "Caissier" },
      { value: "portier",  label: "Portier" },
    ];
  })();

  const showPwExpiry = role === "caissier" || role === "portier";
  const showPresidentCheckbox = isOdcavRole && role === "admin_zone";
  const showZoneSelector = isOdcavRole && !isDirectsMode && !zoneParam && role && role !== "c3" && role !== "super_admin";
  const showCityField = role === "c3";
  const showZoneCheckboxes = isDirectsMode && role === "c3";
  const showModuleSelector = isDirectsMode && role === "super_admin";

  function toggleZone(id: string) {
    setSelectedZones((prev) =>
      prev.includes(id) ? prev.filter((z) => z !== id) : [...prev, id]
    );
  }

  function getPwDurationMinutes(): number | null {
    if (pwUnit === "jamais") return null;
    if (pwUnit === "24h") return 1440;
    if (pwUnit === "heures") return Math.max(1, pwValue) * 60;
    return Math.max(1, pwValue); // minutes
  }

  function toggleModule(key: string) {
    setSelectedModules((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  const backHref = isDirectsMode ? "/utilisateurs?tab=directs" : zoneParam ? `/utilisateurs?zone=${zoneParam}` : "/utilisateurs";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const permittedModules = showModuleSelector && !allModules && selectedModules.length > 0
      ? selectedModules
      : null;

    const result = await createUser({
      email,
      fullName,
      phone,
      role: role as any,
      zoneId: isDirectsMode || role === "c3" || role === "super_admin" ? null : zoneId || null,
      isPresident: role === "admin_zone" ? isPresident : false,
      city: showCityField ? city || null : null,
      permittedModules,
      allowedZones: showZoneCheckboxes && selectedZones.length > 0 ? selectedZones : null,
      passwordDurationMinutes: showPwExpiry ? getPwDurationMinutes() : null,
    });

    if (result.error) {
      toast.error(result.error);
      setLoading(false);
      return;
    }

    if (result.password) {
      setTempPassword(result.password);
      toast.success("Utilisateur créé avec succès");
    }
    setLoading(false);
  }

  function copyPassword() {
    if (tempPassword) {
      navigator.clipboard.writeText(tempPassword);
      toast.success("Mot de passe copié");
    }
  }

  if (tempPassword) {
    return (
      <div className="max-w-md mx-auto space-y-6">
        <Card className="border-success/30 bg-success/5">
          <CardHeader>
            <CardTitle className="text-success">Utilisateur créé avec succès</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Voici le mot de passe temporaire. Il ne sera plus affiché. Transmettez-le à l&apos;utilisateur.
            </p>
            <div className="flex items-center gap-2 bg-white p-3 rounded-lg border">
              <code className="text-lg font-bold flex-1">{tempPassword}</code>
              <Button variant="outline" size="sm" onClick={copyPassword}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Link href={backHref} className="flex-1">
                <Button variant="outline" className="w-full">Retour à la liste</Button>
              </Link>
              <Button
                className="flex-1 bg-brand hover:bg-brand/90"
                onClick={() => {
                  setTempPassword(null);
                  setEmail(""); setFullName(""); setPhone(""); setRole(""); setZoneId(zoneParam ?? "");
                  setIsPresident(false); setCity(""); setSelectedZones([]); setAllModules(true); setSelectedModules([]);
                  setPwUnit("jamais"); setPwValue(30);
                }}
              >
                Créer un autre
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href={backHref}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />Retour
          </Button>
        </Link>
        <h1 className="text-2xl font-bold font-heading">Nouvel utilisateur</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nom complet</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Aminata Diallo" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="aminata@email.com" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+221 77 123 45 67" />
            </div>

            <div className="space-y-2">
              <Label>Rôle</Label>
              <Select value={role} onValueChange={(v) => setRole(v ?? "")} required>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un rôle" />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Ville — only for C3 */}
            {showCityField && (
              <div className="space-y-2">
                <Label htmlFor="city">Ville</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="ex: NGUEKOKH"
                />
                <p className="text-xs text-muted-foreground">Le compte s&apos;appellera C3 {city || "…"}</p>
              </div>
            )}

            {/* Zones accessibles — for C3 in directs mode */}
            {showZoneCheckboxes && (
              <div className="rounded-lg border p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold">Zones accessibles</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Sélectionnez les zones dont ce C3 pourra voir les équipes et créer des matchs
                  </p>
                </div>
                {zones.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Aucune zone disponible</p>
                ) : (
                  <div className="space-y-2">
                    {zones.map((zone) => (
                      <div key={zone.id} className="flex items-center gap-3">
                        <Checkbox
                          id={`zone-${zone.id}`}
                          checked={selectedZones.includes(zone.id)}
                          onCheckedChange={() => toggleZone(zone.id)}
                        />
                        <Label htmlFor={`zone-${zone.id}`} className="cursor-pointer text-sm font-normal">
                          {zone.name}
                          {zone.region && <span className="text-muted-foreground ml-1 text-xs">({zone.region})</span>}
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
                {selectedZones.length > 0 && (
                  <p className="text-xs text-brand font-medium">
                    {selectedZones.length} zone(s) sélectionnée(s)
                  </p>
                )}
              </div>
            )}

            {/* Module permissions — for direct super_admin sub-accounts */}
            {showModuleSelector && (
              <div className="rounded-lg border p-4 space-y-3">
                <p className="text-sm font-semibold">Modules accessibles</p>
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="allModules"
                    checked={allModules}
                    onCheckedChange={(v: boolean | "indeterminate") => setAllModules(v === true)}
                  />
                  <Label htmlFor="allModules" className="cursor-pointer font-medium">Tous les modules</Label>
                </div>
                {!allModules && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {ADMIN_MODULES.map((mod) => (
                      <div key={mod.key} className="flex items-center gap-2">
                        <Checkbox
                          id={`mod-${mod.key}`}
                          checked={selectedModules.includes(mod.key)}
                          onCheckedChange={() => toggleModule(mod.key)}
                        />
                        <Label htmlFor={`mod-${mod.key}`} className="cursor-pointer text-sm">{mod.label}</Label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Durée d'expiration du mot de passe — caissier / portier */}
            {showPwExpiry && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <p className="text-sm font-semibold text-blue-900">Durée du mot de passe</p>
                </div>
                <div className="flex items-center gap-2">
                  {(pwUnit === "minutes" || pwUnit === "heures") && (
                    <Input
                      type="number"
                      min={1}
                      max={pwUnit === "minutes" ? 1440 : 72}
                      value={pwValue}
                      onChange={(e) => setPwValue(Math.max(1, Number(e.target.value)))}
                      className="w-24 bg-white"
                    />
                  )}
                  <Select value={pwUnit} onValueChange={(v) => {
                    setPwUnit(v as typeof pwUnit);
                    if (v === "minutes") setPwValue(30);
                    if (v === "heures") setPwValue(8);
                  }}>
                    <SelectTrigger className="flex-1 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="jamais">Jamais (pas d&apos;expiration)</SelectItem>
                      <SelectItem value="minutes">Minutes</SelectItem>
                      <SelectItem value="heures">Heures</SelectItem>
                      <SelectItem value="24h">24 heures</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-blue-700">
                  {pwUnit === "jamais" && "Le mot de passe n'expirera jamais."}
                  {pwUnit === "minutes" && `Le mot de passe expirera ${pwValue} minute${pwValue > 1 ? "s" : ""} après la création.`}
                  {pwUnit === "heures" && `Le mot de passe expirera ${pwValue} heure${pwValue > 1 ? "s" : ""} après la création.`}
                  {pwUnit === "24h" && "Le mot de passe expirera 24 heures après la création."}
                </p>
              </div>
            )}

            {/* Président de zone */}
            {showPresidentCheckbox && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-1">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="isPresident"
                    checked={isPresident}
                    onCheckedChange={(v: boolean | "indeterminate") => setIsPresident(v === true)}
                  />
                  <Label htmlFor="isPresident" className="flex items-center gap-2 cursor-pointer font-semibold text-amber-800">
                    <Crown className="h-4 w-4 text-amber-600" />
                    Président de zone
                  </Label>
                </div>
                <p className="text-xs text-amber-700 ml-7">
                  Le président peut créer d&apos;autres comptes Admin Zone, Caissier et Portier. Son compte ne peut être modifié que par le Super Admin.
                </p>
              </div>
            )}

            {/* Zone selector — super_admin creating zone-based role */}
            {showZoneSelector && (
              <div className="space-y-2">
                <Label>Zone</Label>
                <Select value={zoneId} onValueChange={(v) => setZoneId(v ?? "")} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir une zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {zones.map((zone) => (
                      <SelectItem key={zone.id} value={zone.id}>{zone.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button type="submit" className="w-full bg-brand hover:bg-brand/90" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Créer l'utilisateur"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
