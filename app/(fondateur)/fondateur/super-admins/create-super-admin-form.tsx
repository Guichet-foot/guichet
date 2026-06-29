"use client";

import { useState } from "react";
import { createSuperAdmin } from "@/lib/actions/fondateur-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Loader2, Copy } from "lucide-react";
import { toast } from "sonner";

export function CreateSuperAdminForm() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  async function handleSubmit() {
    if (!email || !fullName) { toast.error("Remplissez email et nom"); return; }
    setLoading(true);
    const result = await createSuperAdmin({ email, fullName, phone });
    if (result.error) { toast.error(result.error); }
    else { setTempPassword(result.password!); toast.success("Super Admin créé"); }
    setLoading(false);
  }

  function resetForm() {
    setEmail(""); setFullName(""); setPhone(""); setTempPassword(null);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger render={<Button className="bg-amber-600 hover:bg-amber-700" />}>
        <Plus className="h-4 w-4 mr-2" />
        Nouveau Super Admin
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{tempPassword ? "Compte créé" : "Nouveau Super Admin"}</DialogTitle></DialogHeader>
        {tempPassword ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Mot de passe temporaire :</p>
            <div className="flex items-center gap-2 bg-muted p-3 rounded-lg border">
              <code className="text-lg font-bold flex-1">{tempPassword}</code>
              <Button type="button" variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(tempPassword); toast.success("Copié"); }}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-danger">Ce mot de passe ne sera plus affiché.</p>
            <Button type="button" onClick={() => { resetForm(); setOpen(false); }} className="w-full">Fermer</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom complet</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Nom du super admin" />
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
