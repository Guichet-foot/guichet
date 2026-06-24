"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createUser } from "@/lib/actions/user-actions";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import type { Zone } from "@/lib/types";

export default function NewUserPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [zones, setZones] = useState<Zone[]>([]);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>("");

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<string>("");
  const [zoneId, setZoneId] = useState<string>("");

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, zone_id")
        .eq("id", user.id)
        .single();

      if (profile) {
        setCurrentUserRole(profile.role);
        if (profile.role === "admin_zone" && profile.zone_id) {
          setZoneId(profile.zone_id);
        }
      }

      if (profile?.role === "super_admin") {
        const { data } = await supabase
          .from("zones")
          .select("*")
          .order("name");
        if (data) setZones(data);
      }
    }
    init();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const result = await createUser({
      email,
      fullName,
      phone,
      role: role as "super_admin" | "admin_zone" | "caissier",
      zoneId: role === "super_admin" ? null : zoneId || null,
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
            <CardTitle className="text-success">
              Utilisateur créé avec succès
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Voici le mot de passe temporaire. Il ne sera plus affiché.
              Transmettez-le à l&apos;utilisateur.
            </p>
            <div className="flex items-center gap-2 bg-white p-3 rounded-lg border">
              <code className="text-lg font-bold flex-1">{tempPassword}</code>
              <Button variant="outline" size="sm" onClick={copyPassword}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Link href="/utilisateurs" className="flex-1">
                <Button variant="outline" className="w-full">
                  Retour à la liste
                </Button>
              </Link>
              <Button
                className="flex-1 bg-brand hover:bg-brand/90"
                onClick={() => {
                  setTempPassword(null);
                  setEmail("");
                  setFullName("");
                  setPhone("");
                  setRole("");
                  setZoneId("");
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
            <ArrowLeft className="h-4 w-4 mr-1" />
            Retour
          </Button>
        </Link>
        <h1 className="text-2xl font-bold font-heading">Nouvel utilisateur</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nom complet</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="Aminata Diallo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="aminata@email.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+221 77 123 45 67"
              />
            </div>

            <div className="space-y-2">
              <Label>Rôle</Label>
              <Select value={role} onValueChange={(v) => setRole(v ?? "")} required>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un rôle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="caissier">Caissier</SelectItem>
                  <SelectItem value="admin_zone">Admin Zone</SelectItem>
                  {currentUserRole === "super_admin" && (
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {role && role !== "super_admin" && currentUserRole === "super_admin" && (
              <div className="space-y-2">
                <Label>Zone</Label>
                <Select value={zoneId} onValueChange={(v) => setZoneId(v ?? "")} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir une zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {zones.map((zone) => (
                      <SelectItem key={zone.id} value={zone.id}>
                        {zone.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-brand hover:bg-brand/90"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Créer l'utilisateur"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
