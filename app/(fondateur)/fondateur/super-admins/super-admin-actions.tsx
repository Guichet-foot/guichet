"use client";

import { useState } from "react";
import { toggleSuperAdminActive, deleteSuperAdmin } from "@/lib/actions/fondateur-actions";
import { Button } from "@/components/ui/button";
import { Loader2, Ban, CheckCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface SuperAdminActionsProps {
  userId: string;
  active: boolean;
  name: string;
}

export function SuperAdminActions({ userId, active, name }: SuperAdminActionsProps) {
  const [loading, setLoading] = useState<string | null>(null);

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

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={handleToggle} disabled={loading === "toggle"}
        className={`h-7 w-7 p-0 ${active ? "text-orange-500" : "text-green-600"}`} title={active ? "Suspendre" : "Réactiver"}>
        {loading === "toggle" ? <Loader2 className="h-3 w-3 animate-spin" /> : active ? <Ban className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={handleDelete} disabled={loading === "delete"}
        className="h-7 w-7 p-0 text-danger" title="Supprimer">
        {loading === "delete" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
      </Button>
    </>
  );
}
