"use client";

import { useState } from "react";
import { createSuperAdmin } from "@/lib/actions/fondateur-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2, Copy, Crown } from "lucide-react";
import { toast } from "sonner";

export function CreateSuperAdminForm() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"super_admin" | "president_odcav">("super_admin");

  async function handleSubmit() {
    if (!email || !fullName) { toast.error("Remplissez email et nom"); return; }
    setLoading(true);
    const result = await createSuperAdmin({ email, fullName, phone, role });
    if (result.error) { toast.error(result.error); }
    else { setTempPassword(result.password!); toast.success("Compte créé"); }
    setLoading(false);
  }

  function resetForm() {
    setEmail(""); setFullName(""); setPhone(""); setTempPassword(null); setRole("super_admin");
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger render={<Button className="bg-amber-600 hover:bg-amber-700" />}>
        <Plus className="h-4 w-4 mr-2" />
        Nouveau compte
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tempPassword ? "Compte créé" : "Nouveau compte admin ODCAV"}</DialogTitle>
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
                onClick={() => { navigator.clipboard.writeText(tempPassword); toast.success("Copié"); }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-danger">Ce mot de passe ne sera plus affiché.</p>
            <Button type="button" onClick={() => { resetForm(); setOpen(false); }} className="w-full">Fermer</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type de compte</Label>
              <Select value={role} onValueChange={(v) => setRole(v as "super_admin" | "president_odcav")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="president_odcav">Président ODCAV</SelectItem>
                </SelectContent>
              </Select>
              {role === "president_odcav" && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                  Le Président ODCAV a les mêmes droits que le Super Admin. Son compte est protégé — seul vous pouvez le modifier ou le supprimer.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Nom complet</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Nom du compte" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="email@exemple.com" />
            </div>
            <div className="space-y-2">
              <Label>Téléphone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+221 77 000 00 00" />
            </div>
            <Button type="button" onClick={handleSubmit} disabled={loading} className="w-full bg-amber-600 hover:bg-amber-700">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Créer le compte"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
