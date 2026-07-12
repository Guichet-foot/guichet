"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createFondateurSubUser } from "@/lib/actions/fondateur-actions";
import { FONDATEUR_MODULES } from "@/lib/constants";
import { UserPlus, Copy, Check } from "lucide-react";

type SubRole = "assistant_fondateur" | "billetterie_fondateur";

export function CreateFondateurUserForm() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<SubRole>("assistant_fondateur");
  const [permittedModules, setPermittedModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleModule(key: string) {
    setPermittedModules((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function toggleAll() {
    if (permittedModules.length === FONDATEUR_MODULES.length) {
      setPermittedModules([]);
    } else {
      setPermittedModules(FONDATEUR_MODULES.map((m) => m.key));
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const result = await createFondateurSubUser({
      email: fd.get("email") as string,
      fullName: fd.get("fullName") as string,
      phone: fd.get("phone") as string,
      role,
      permittedModules,
    });
    setLoading(false);
    if ("error" in result) {
      setError(result.error as string);
    } else if ("password" in result) {
      setTempPassword(result.password as string);
    }
  }

  function handleCopy() {
    if (tempPassword) {
      navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleClose() {
    setOpen(false);
    setRole("assistant_fondateur");
    setPermittedModules([]);
    setLoading(false);
    setTempPassword(null);
    setError(null);
    setCopied(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
      <DialogTrigger className="inline-flex items-center gap-2 h-9 px-3 rounded-md bg-ink text-white text-sm font-medium hover:bg-ink/90 transition-colors">
        <UserPlus className="h-4 w-4" />
        Nouvel utilisateur
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Créer un utilisateur</DialogTitle>
        </DialogHeader>

        {tempPassword ? (
          <div className="space-y-4">
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
              Compte créé avec succès. Partagez ce mot de passe temporaire :
            </p>
            <div className="flex items-center gap-2 bg-gray-50 border rounded-lg px-3 py-2">
              <code className="flex-1 font-mono text-lg tracking-widest">{tempPassword}</code>
              <Button size="sm" variant="ghost" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <Button className="w-full" onClick={handleClose}>Fermer</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Nom complet</Label>
              <Input id="fullName" name="fullName" required placeholder="Ex: Ibrahima Diallo" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required placeholder="utilisateur@email.com" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">Téléphone</Label>
              <Input id="phone" name="phone" placeholder="77 000 00 00" />
            </div>

            <div className="space-y-1.5">
              <Label>Rôle</Label>
              <Select value={role} onValueChange={(v) => setRole((v ?? "assistant_fondateur") as SubRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="assistant_fondateur">Assistant</SelectItem>
                  <SelectItem value="billetterie_fondateur">Billetterie</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Modules accessibles</Label>
                <button type="button" onClick={toggleAll} className="text-xs text-brand hover:underline">
                  {permittedModules.length === FONDATEUR_MODULES.length ? "Tout désélectionner" : "Tout sélectionner"}
                </button>
              </div>
              <div className="border rounded-lg divide-y">
                {FONDATEUR_MODULES.map((mod) => (
                  <label key={mod.key} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50">
                    <Checkbox
                      checked={permittedModules.includes(mod.key)}
                      onCheckedChange={() => toggleModule(mod.key)}
                    />
                    <span className="text-sm">{mod.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>}

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={handleClose}>
                Annuler
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? "Création..." : "Créer le compte"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
