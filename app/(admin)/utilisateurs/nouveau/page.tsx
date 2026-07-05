"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { ArrowLeft, Copy, Loader2, Crown } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import type { Zone } from "@/lib/types";

export default function NewUserPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [zones, setZones] = useState<Zone[]>([]);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const [currentUserRole, setCurrentUserRole] = useState<string>("");
  const [currentUserIsPresident, setCurrentUserIsPresident] = useState(false);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<string>("");
  const [zoneId, setZoneId] = useState<string>("");
  const [isPresident, setIsPresident] = useState(false);

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

      if (profile?.role === "super_admin") {
        const { data } = await supabase.from("zones").select("*").order("name");
        if (data) setZones(data);
      }
    }
    init();
  }, []);

  // Reset isPresident when role changes away from admin_zone
  useEffect(() => {
    if (role !== "admin_zone") setIsPresident(false);
  }, [role]);

  // Available roles depend on who is creating
  const availableRoles = (() => {
    if (currentUserRole === "super_admin") {
      return [
        { value: "admin_zone", label: "Admin Zone" },
        { value: "c3",         label: "Coordination C3" },
        { value: "caissier",   label: "Caissier" },
        { value: "portier",    label: "Portier" },
        { value: "super_admin",label: "Super Admin" },
      ];
    }
    if (currentUserRole === "admin_zone" && currentUserIsPresident) {
      return [
        { value: "admin_zone", label: "Admin Zone" },
        { value: "caissier",   label: "Caissier" },
        { value: "portier",    label: "Portier" },
      ];
    }
    // Regular admin_zone or c3: caissier/portier only
    return [
      { value: "caissier", label: "Caissier" },
      { value: "portier",  label: "Portier" },
    ];
  })();

  // Show "Président de zone" checkbox only for super_admin creating an admin_zone
  const showPresidentCheckbox = currentUserRole === "super_admin" && role === "admin_zone";
  // C3 has no zone assignment — hide zone selector for c3 role
  const hideZoneSelector = role === "c3" || role === "super_admin";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const result = await createUser({
      email,
      fullName,
      phone,
      role: role as "super_admin" | "admin_zone" | "caissier" | "portier",
      zoneId: (role === "super_admin" || role === "c3") ? null : zoneId || null,
      isPresident: role === "admin_zone" ? isPresident : false,
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
              <Link href="/utilisateurs" className="flex-1">
                <Button variant="outline" className="w-full">Retour à la liste</Button>
              </Link>
              <Button
                className="flex-1 bg-brand hover:bg-brand/90"
                onClick={() => {
                  setTempPassword(null);
                  setEmail(""); setFullName(""); setPhone(""); setRole(""); setZoneId(""); setIsPresident(false);
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
        <Link href="/utilisateurs">
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

            {/* Président de zone — only super_admin creating an admin_zone */}
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

            {/* Zone selector — super_admin only, for zone-based roles */}
            {role && !hideZoneSelector && currentUserRole === "super_admin" && (
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
