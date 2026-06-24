"use client";

import { updateMatchStatus } from "@/lib/actions/match-actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MATCH_STATUS_LABELS } from "@/lib/constants";
import { toast } from "sonner";
import type { MatchStatus } from "@/lib/types";

export function MatchStatusSelect({
  matchId,
  currentStatus,
}: {
  matchId: string;
  currentStatus: string;
}) {
  async function handleChange(value: string) {
    const result = await updateMatchStatus(matchId, value as MatchStatus);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Statut mis à jour");
    }
  }

  return (
    <Select defaultValue={currentStatus} onValueChange={(v) => v && handleChange(v)}>
      <SelectTrigger className="w-[140px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(MATCH_STATUS_LABELS).map(([value, label]) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
