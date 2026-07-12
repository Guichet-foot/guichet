"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fondateurToggleUserActive, fondateurDeleteUser, fondateurResetPassword } from "@/lib/actions/fondateur-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Power, Trash2, KeyRound, Copy, Loader2, Ban } from "lucide-react";
import { toast } from "sonner";

interface Props {
  userId: string;
  odcavId: string;
  userName: string;
  active: boolean;
}

export function UserItemActions({ userId, odcavId, userName, active }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  async function handleToggleActive() {
    setLoading("toggle");
    const result = await fondateurToggleUserActive(userId, !active);
    setLoading(null);
    if (result.error) toast.error(result.error);
    else { toast.success(active ? "Compte suspendu" : "Compte réactivé"); router.refresh(); }
  }

  async function handleResetPassword() {
    setLoading("password");
    const result = await fondateurResetPassword(userId);
    setLoading(null);
    if (result.error) { toast.error(result.error); return; }
    setNewPassword(result.password!);
    setShowPassword(true);
  }

  async function handleDelete() {
    if (!confirm(`Supprimer le compte de "${userName}" ? Cette action est irréversible.`)) return;
    setLoading("delete");
    const result = await fondateurDeleteUser(userId, odcavId);
    setLoading(null);
    if (result.error) toast.error(result.error);
    else { toast.success("Compte supprimé"); router.refresh(); }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        onClick={handleResetPassword}
        disabled={loading === "password"}
        title="Réinitialiser mot de passe"
      >
        {loading === "password" ? <Loader2 className="h-3 w-3 animate-spin" /> : <KeyRound className="h-3 w-3" />}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={`h-7 w-7 p-0 ${active ? "text-orange-500" : "text-green-600"}`}
        onClick={handleToggleActive}
        disabled={loading === "toggle"}
        title={active ? "Suspendre" : "Réactiver"}
      >
        {loading === "toggle" ? <Loader2 className="h-3 w-3 animate-spin" /> : active ? <Ban className="h-3 w-3" /> : <Power className="h-3 w-3" />}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 text-destructive"
        onClick={handleDelete}
        disabled={loading === "delete"}
        title="Supprimer"
      >
        {loading === "delete" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
      </Button>

      {/* New password dialog */}
      <Dialog open={showPassword} onOpenChange={setShowPassword}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nouveau mot de passe</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Mot de passe de <strong>{userName}</strong> :</p>
            <div className="flex items-center gap-2 bg-muted p-3 rounded-lg border">
              <code className="text-lg font-bold flex-1">{newPassword}</code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { navigator.clipboard.writeText(newPassword!); toast.success("Copié"); }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-destructive">Ce mot de passe ne sera plus affiché.</p>
            <Button className="w-full" onClick={() => setShowPassword(false)}>Fermer</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
