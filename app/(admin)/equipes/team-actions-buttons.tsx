"use client";

import { useState } from "react";
import { deleteTeam } from "@/lib/actions/team-actions";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { TeamFormDialog } from "./team-form-dialog";
import type { UserRole } from "@/lib/types";

interface TeamActionsProps {
  team: {
    id: string;
    name: string;
    president: string | null;
    delegates: string[];
    colors: string | null;
    zone_id: string;
  };
  zoneId: string | null;
  userRole: UserRole;
}

export function TeamActions({ team, zoneId, userRole }: TeamActionsProps) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Supprimer l'équipe "${team.name}" ?`)) return;
    setDeleting(true);
    const result = await deleteTeam(team.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Équipe supprimée");
    }
    setDeleting(false);
  }

  return (
    <div className="flex gap-1 justify-end">
      <TeamFormDialog
        zoneId={zoneId}
        userRole={userRole}
        editTeam={team}
        trigger={
          <Button variant="ghost" size="sm">
            <Pencil className="h-4 w-4" />
          </Button>
        }
      />
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDelete}
        disabled={deleting}
        className="text-danger"
      >
        {deleting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
