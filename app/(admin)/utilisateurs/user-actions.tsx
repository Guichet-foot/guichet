"use client";

import { useState } from "react";
import {
  toggleUserActive,
  updateUserInfo,
  updateSelfInfo,
  resetUserPassword,
  deleteUser,
} from "@/lib/actions/user-actions";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  Pencil,
  KeyRound,
  Ban,
  CheckCircle,
  Trash2,
  Copy,
  ShieldAlert,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { ROLE_LABELS } from "@/lib/constants";

interface UserActionsProps {
  user: {
    id: string;
    full_name: string;
    phone: string | null;
    role: string;
    active: boolean;
    is_president: boolean;
  };
  currentUserId: string;
  currentUserRole: string;
  currentUserIsPresident: boolean;
}

export function UserActions({
  user,
  currentUserId,
  currentUserRole,
  currentUserIsPresident,
}: UserActionsProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState<string | null>(null);

  const [fullName, setFullName] = useState(user.full_name);
  const [phone, setPhone] = useState(user.phone || "");
  const [role, setRole] = useState(user.role);

  // Self password change fields
  const [selfPassword, setSelfPassword] = useState("");
  const [selfPasswordConfirm, setSelfPasswordConfirm] = useState("");
  const [showSelfPwd, setShowSelfPwd] = useState(false);

  const isSelf = user.id === currentUserId;

  // A Président de zone can only be managed by super_admin
  const isProtectedPresident = user.is_president && currentUserRole !== "super_admin";

  // Roles available in the edit dialog
  const editableRoles = (() => {
    if (currentUserRole === "super_admin") {
      return ["caissier", "portier", "admin_zone", "super_admin"];
    }
    if (currentUserRole === "admin_zone" && currentUserIsPresident) {
      return ["caissier", "portier", "admin_zone"];
    }
    return ["caissier", "portier"];
  })();

  async function handleUpdateInfo() {
    setLoading("edit");
    const result = await updateUserInfo(user.id, { fullName, phone, role });
    if (result.error) toast.error(result.error);
    else { toast.success("Informations modifiées"); setEditOpen(false); }
    setLoading(null);
  }

  async function handleUpdateSelf() {
    setLoading("edit");
    const result = await updateSelfInfo({ fullName, phone });
    if (result.error) toast.error(result.error);
    else { toast.success("Vos informations ont été mises à jour"); setEditOpen(false); }
    setLoading(null);
  }

  async function handleSelfPasswordChange() {
    if (selfPassword.length < 6) { toast.error("Le mot de passe doit faire au moins 6 caractères"); return; }
    if (selfPassword !== selfPasswordConfirm) { toast.error("Les mots de passe ne correspondent pas"); return; }
    setLoading("password");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: selfPassword });
    if (error) toast.error(error.message);
    else {
      toast.success("Mot de passe modifié avec succès");
      setPasswordOpen(false);
      setSelfPassword("");
      setSelfPasswordConfirm("");
    }
    setLoading(null);
  }

  async function handleResetPassword() {
    setLoading("password");
    const result = await resetUserPassword(user.id);
    if (result.error) toast.error(result.error);
    else setNewPassword(result.password!);
    setLoading(null);
  }

  async function handleToggleActive() {
    setLoading("toggle");
    const result = await toggleUserActive(user.id, !user.active);
    if (result.error) toast.error(result.error);
    else toast.success(user.active ? "Compte suspendu" : "Compte réactivé");
    setLoading(null);
  }

  async function handleDelete() {
    if (!confirm(`Supprimer définitivement "${user.full_name}" ? Cette action est irréversible.`)) return;
    setLoading("delete");
    const result = await deleteUser(user.id);
    if (result.error) toast.error(result.error);
    else toast.success("Utilisateur supprimé");
    setLoading(null);
  }

  function copyPassword() {
    if (newPassword) {
      navigator.clipboard.writeText(newPassword);
      toast.success("Mot de passe copié");
    }
  }

  // Self: limited actions — edit own info + change own password
  if (isSelf) {
    return (
      <>
        <div className="flex gap-1 justify-end">
          <Button
            type="button" variant="ghost" size="sm"
            onClick={() => setEditOpen(true)}
            title="Modifier mes informations"
            className="h-7 w-7 p-0"
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            type="button" variant="ghost" size="sm"
            onClick={() => { setSelfPassword(""); setSelfPasswordConfirm(""); setPasswordOpen(true); }}
            title="Changer mon mot de passe"
            className="h-7 w-7 p-0"
          >
            <KeyRound className="h-3 w-3" />
          </Button>
        </div>

        {/* Edit self info dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mes informations</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nom complet</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Téléphone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+221 77 123 45 67" />
              </div>
              <Button
                type="button"
                onClick={handleUpdateSelf}
                disabled={loading === "edit"}
                className="w-full bg-brand hover:bg-brand/90"
              >
                {loading === "edit" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Change own password dialog */}
        <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Changer mon mot de passe</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nouveau mot de passe</Label>
                <div className="relative">
                  <Input
                    type={showSelfPwd ? "text" : "password"}
                    value={selfPassword}
                    onChange={(e) => setSelfPassword(e.target.value)}
                    placeholder="Min. 6 caractères"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSelfPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showSelfPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Confirmer le mot de passe</Label>
                <Input
                  type={showSelfPwd ? "text" : "password"}
                  value={selfPasswordConfirm}
                  onChange={(e) => setSelfPasswordConfirm(e.target.value)}
                  placeholder="Répétez le mot de passe"
                />
              </div>
              <Button
                type="button"
                onClick={handleSelfPasswordChange}
                disabled={loading === "password" || !selfPassword}
                className="w-full bg-brand hover:bg-brand/90"
              >
                {loading === "password" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Changer le mot de passe"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // President account: show a lock indicator for non-super_admin
  if (isProtectedPresident) {
    return (
      <div className="flex justify-end">
        <span
          className="flex items-center gap-1 text-xs text-amber-700 font-medium px-2 py-1 rounded bg-amber-50 border border-amber-200"
          title="Seul le Super Admin peut modifier ce compte"
        >
          <ShieldAlert className="h-3 w-3" />
          Protégé
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-1 justify-end">
        <Button
          type="button" variant="ghost" size="sm"
          onClick={() => setEditOpen(true)}
          title="Modifier"
          className="h-7 w-7 p-0"
        >
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          type="button" variant="ghost" size="sm"
          onClick={() => { setNewPassword(null); setPasswordOpen(true); }}
          title="Réinitialiser le mot de passe"
          className="h-7 w-7 p-0"
        >
          <KeyRound className="h-3 w-3" />
        </Button>
        <Button
          type="button" variant="ghost" size="sm"
          onClick={handleToggleActive}
          disabled={loading === "toggle"}
          title={user.active ? "Suspendre" : "Réactiver"}
          className={`h-7 w-7 p-0 ${user.active ? "text-orange-500" : "text-success"}`}
        >
          {loading === "toggle"
            ? <Loader2 className="h-3 w-3 animate-spin" />
            : user.active ? <Ban className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />
          }
        </Button>
        <Button
          type="button" variant="ghost" size="sm"
          onClick={handleDelete}
          disabled={loading === "delete"}
          title="Supprimer"
          className="h-7 w-7 p-0 text-danger"
        >
          {loading === "delete"
            ? <Loader2 className="h-3 w-3 animate-spin" />
            : <Trash2 className="h-3 w-3" />
          }
        </Button>
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l&apos;utilisateur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom complet</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Téléphone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+221 77 123 45 67" />
            </div>
            <div className="space-y-2">
              <Label>Rôle</Label>
              <Select value={role} onValueChange={(v) => setRole(v ?? role)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {editableRoles.includes("caissier")   && <SelectItem value="caissier">{ROLE_LABELS.caissier}</SelectItem>}
                  {editableRoles.includes("portier")    && <SelectItem value="portier">{ROLE_LABELS.portier}</SelectItem>}
                  {editableRoles.includes("admin_zone") && <SelectItem value="admin_zone">{ROLE_LABELS.admin_zone}</SelectItem>}
                  {editableRoles.includes("super_admin")&& <SelectItem value="super_admin">{ROLE_LABELS.super_admin}</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              onClick={handleUpdateInfo}
              disabled={loading === "edit"}
              className="w-full bg-brand hover:bg-brand/90"
            >
              {loading === "edit" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Password dialog */}
      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!newPassword ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Un nouveau mot de passe sera généré pour <strong>{user.full_name}</strong>. Transmettez-le à l&apos;utilisateur.
                </p>
                <Button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={loading === "password"}
                  className="w-full bg-brand hover:bg-brand/90"
                >
                  {loading === "password" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Générer un nouveau mot de passe"}
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Nouveau mot de passe pour <strong>{user.full_name}</strong> :
                </p>
                <div className="flex items-center gap-2 bg-muted p-3 rounded-lg border">
                  <code className="text-lg font-bold flex-1">{newPassword}</code>
                  <Button type="button" variant="outline" size="sm" onClick={copyPassword}>
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
