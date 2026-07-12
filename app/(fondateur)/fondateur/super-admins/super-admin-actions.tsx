"use client";

import { useState } from "react";
import {
  toggleSuperAdminActive,
  deleteSuperAdmin,
  updateSuperAdminInfo,
  resetSuperAdminPassword,
  fondateurUpdateSuperAdminModules,
} from "@/lib/actions/fondateur-actions";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Ban, CheckCircle, Trash2, Pencil, KeyRound, Copy } from "lucide-react";
import { toast } from "sonner";
import { ADMIN_MODULES } from "@/lib/constants";

interface SuperAdminActionsProps {
  userId: string;
  active: boolean;
  name: string;
  phone?: string;
  email?: string;
  role: string;
  permittedModules?: string[] | null;
}

export function SuperAdminActions({ userId, active, name, phone, email, role, permittedModules }: SuperAdminActionsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState<string | null>(null);

  const [editName, setEditName] = useState(name);
  const [editPhone, setEditPhone] = useState(phone || "");
  const [editEmail, setEditEmail] = useState(email || "");
  const [editRole, setEditRole] = useState<"super_admin" | "president_odcav">(
    role === "president_odcav" ? "president_odcav" : "super_admin"
  );
  const [selectedModules, setSelectedModules] = useState<string[]>(permittedModules || []);

  function openEdit() {
    setEditName(name);
    setEditPhone(phone || "");
    setEditEmail(email || "");
    setEditRole(role === "president_odcav" ? "president_odcav" : "super_admin");
    setSelectedModules(permittedModules || []);
    setEditOpen(true);
  }

  async function handleToggle() {
    setLoading("toggle");
    const result = await toggleSuperAdminActive(userId, !active) as any;
    if (result.error) toast.error(result.error);
    else toast.success(active ? "Compte suspendu" : "Compte réactivé");
    setLoading(null);
  }

  async function handleDelete() {
    if (!confirm(`Supprimer définitivement "${name}" ? Cette action est irréversible.`)) return;
    setLoading("delete");
    const result = await deleteSuperAdmin(userId) as any;
    if (result.error) toast.error(result.error);
    else toast.success("Compte supprimé");
    setLoading(null);
  }

  async function handleUpdateInfo() {
    setLoading("edit");
    const result = await updateSuperAdminInfo(userId, {
      fullName: editName,
      phone: editPhone,
      email: editEmail,
      role: editRole,
    }) as any;
    if (result.error) { toast.error(result.error); setLoading(null); return; }

    const modResult = await fondateurUpdateSuperAdminModules(userId, selectedModules) as any;
    if (modResult.error) { toast.error(modResult.error); setLoading(null); return; }

    toast.success("Informations modifiées");
    setEditOpen(false);
    setLoading(null);
  }

  async function handleResetPassword() {
    setLoading("password");
    const result = await resetSuperAdminPassword(userId) as any;
    if (result.error) toast.error(result.error);
    else setNewPassword(result.password);
    setLoading(null);
  }

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={openEdit}
        className="h-7 w-7 p-0" title="Modifier">
        <Pencil className="h-3 w-3" />
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => { setNewPassword(null); setPasswordOpen(true); }}
        className="h-7 w-7 p-0" title="Mot de passe">
        <KeyRound className="h-3 w-3" />
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={handleToggle} disabled={loading === "toggle"}
        className={`h-7 w-7 p-0 ${active ? "text-orange-500" : "text-green-600"}`} title={active ? "Suspendre" : "Réactiver"}>
        {loading === "toggle" ? <Loader2 className="h-3 w-3 animate-spin" /> : active ? <Ban className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={handleDelete} disabled={loading === "delete"}
        className="h-7 w-7 p-0 text-danger" title="Supprimer">
        {loading === "delete" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
      </Button>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le compte</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type de compte</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as "super_admin" | "president_odcav")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="president_odcav">Président ODCAV</SelectItem>
                </SelectContent>
              </Select>
              {editRole === "president_odcav" && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                  Le Président ODCAV a les mêmes droits que le Super Admin. Son compte est protégé — seul vous pouvez le modifier ou le supprimer.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Nom complet</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Téléphone</Label>
              <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="+221 77 000 00 00" />
            </div>
            <div className="space-y-2">
              <Label>Modules autorisés</Label>
              <p className="text-xs text-muted-foreground">Laissez tout décoché pour accès complet.</p>
              <div className="grid grid-cols-2 gap-2 border rounded-lg p-3">
                {ADMIN_MODULES.map((mod) => (
                  <div key={mod.key} className="flex items-center gap-2">
                    <Checkbox
                      id={`sa-mod-${mod.key}`}
                      checked={selectedModules.includes(mod.key)}
                      onCheckedChange={(checked) => {
                        setSelectedModules((prev) =>
                          checked ? [...prev, mod.key] : prev.filter((k) => k !== mod.key)
                        );
                      }}
                    />
                    <label htmlFor={`sa-mod-${mod.key}`} className="text-sm cursor-pointer">
                      {mod.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <Button type="button" onClick={handleUpdateInfo} disabled={loading === "edit"} className="w-full bg-amber-600 hover:bg-amber-700">
              {loading === "edit" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Password dialog */}
      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Réinitialiser le mot de passe</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {!newPassword ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Un nouveau mot de passe sera généré pour <strong>{name}</strong>.
                </p>
                <Button type="button" onClick={handleResetPassword} disabled={loading === "password"} className="w-full bg-amber-600 hover:bg-amber-700">
                  {loading === "password" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Générer un nouveau mot de passe"}
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Nouveau mot de passe :</p>
                <div className="flex items-center gap-2 bg-muted p-3 rounded-lg border">
                  <code className="text-lg font-bold flex-1">{newPassword}</code>
                  <Button type="button" variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(newPassword); toast.success("Copié"); }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-danger">Ce mot de passe ne sera plus affiché.</p>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
