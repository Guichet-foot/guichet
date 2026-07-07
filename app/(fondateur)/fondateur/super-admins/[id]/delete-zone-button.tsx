"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteZoneComplete } from "@/lib/actions/fondateur-zone-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

interface DeleteZoneButtonProps {
  zoneId: string;
  zoneName: string;
  tickets: number;
  matches: number;
}

export function DeleteZoneButton({ zoneId, zoneName, tickets, matches }: DeleteZoneButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    const result = await deleteZoneComplete(zoneId);
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setOpen(false);
    toast.success(`Zone "${zoneName}" supprimée définitivement`);
    router.refresh();
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-red-600 hover:bg-red-50 hover:text-red-700 shrink-0"
        title="Supprimer cette zone"
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <TriangleAlert className="h-5 w-5" />
              Supprimer la zone
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="font-semibold text-red-900">{zoneName}</p>
              <p className="text-sm text-red-700 mt-1">
                {matches} match{matches !== 1 ? "s" : ""} · {tickets} billet{tickets !== 1 ? "s" : ""} vendu{tickets !== 1 ? "s" : ""}
              </p>
            </div>

            <p className="text-sm text-muted-foreground">
              Cette action supprimera définitivement la zone et <strong>toutes ses données</strong> : matchs, billets, équipes, cartes d&apos;accès, dépenses et comptes utilisateurs associés.
            </p>
            <p className="text-sm font-semibold text-red-600">
              Cette opération est irréversible.
            </p>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Annuler
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={handleDelete}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Supprimer définitivement
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
