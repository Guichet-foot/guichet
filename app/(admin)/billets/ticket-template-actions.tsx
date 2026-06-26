"use client";

import { useState } from "react";
import { deleteTicketTemplate } from "@/lib/actions/ticket-template-actions";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { TicketTemplateForm } from "./ticket-template-form";

interface TicketTemplateActionsProps {
  template: {
    id: string;
    name: string;
    price: number;
    default_quantity: number;
    color: string;
  };
  zoneId: string;
}

export function TicketTemplateActions({ template, zoneId }: TicketTemplateActionsProps) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Supprimer le modèle "${template.name}" ?`)) return;
    setDeleting(true);
    const result = await deleteTicketTemplate(template.id);
    if (result.error) toast.error(result.error);
    else toast.success("Modèle supprimé");
    setDeleting(false);
  }

  return (
    <div className="flex gap-1">
      <TicketTemplateForm
        zoneId={zoneId}
        editTemplate={template}
        trigger={
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
            <Pencil className="h-3 w-3" />
          </Button>
        }
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleDelete}
        disabled={deleting}
        className="h-7 w-7 p-0 text-danger"
      >
        {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
      </Button>
    </div>
  );
}
