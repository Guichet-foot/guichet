"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toggleUserActive } from "@/lib/actions/user-actions";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function ToggleActiveButton({
  userId,
  active,
}: {
  userId: string;
  active: boolean;
}) {
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    const result = await toggleUserActive(userId, !active);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(active ? "Utilisateur désactivé" : "Utilisateur activé");
    }
    setLoading(false);
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleToggle}
      disabled={loading}
      className={active ? "text-danger border-danger" : "text-success border-success"}
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : active ? (
        "Désactiver"
      ) : (
        "Activer"
      )}
    </Button>
  );
}
