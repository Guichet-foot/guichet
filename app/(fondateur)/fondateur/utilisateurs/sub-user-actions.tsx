"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { KeyRound, Ban, Power, Trash2, Copy, Check } from "lucide-react";
import {
  fondateurSubUserToggleActive,
  fondateurSubUserDelete,
  fondateurSubUserResetPassword,
} from "@/lib/actions/fondateur-actions";

interface SubUserActionsProps {
  userId: string;
  isActive: boolean;
}

export function SubUserActions({ userId, isActive }: SubUserActionsProps) {
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  async function handleToggle() {
    setLoading("toggle");
    await fondateurSubUserToggleActive(userId, !isActive);
    setLoading(null);
  }

  async function handleDelete() {
    if (!confirm("Supprimer cet utilisateur ? Cette action est irréversible.")) return;
    setLoading("delete");
    await fondateurSubUserDelete(userId);
    setLoading(null);
  }

  async function handleReset() {
    setLoading("reset");
    const result = await fondateurSubUserResetPassword(userId);
    setLoading(null);
    if ("password" in result) setNewPassword(result.password ?? null);
  }

  function handleCopy() {
    if (newPassword) {
      navigator.clipboard.writeText(newPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          size="sm"
          variant="ghost"
          title="Réinitialiser le mot de passe"
          onClick={handleReset}
          disabled={loading === "reset"}
          className="text-ink/50 hover:text-amber-600 h-8 w-8 p-0"
        >
          <KeyRound className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          title={isActive ? "Désactiver" : "Activer"}
          onClick={handleToggle}
          disabled={loading === "toggle"}
          className={`h-8 w-8 p-0 ${isActive ? "text-ink/50 hover:text-orange-500" : "text-ink/50 hover:text-green-600"}`}
        >
          {isActive ? <Ban className="h-4 w-4" /> : <Power className="h-4 w-4" />}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          title="Supprimer"
          onClick={handleDelete}
          disabled={loading === "delete"}
          className="text-ink/50 hover:text-red-600 h-8 w-8 p-0"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={!!newPassword} onOpenChange={(v) => { if (!v) { setNewPassword(null); setCopied(false); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nouveau mot de passe</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-ink/70">Le mot de passe a été réinitialisé :</p>
          <div className="flex items-center gap-2 bg-gray-50 border rounded-lg px-3 py-2">
            <code className="flex-1 font-mono text-lg tracking-widest">{newPassword}</code>
            <Button size="sm" variant="ghost" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <Button className="w-full" onClick={() => { setNewPassword(null); setCopied(false); }}>
            Fermer
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
