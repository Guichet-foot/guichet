"use client";

import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";

interface ZoneSelectorDropdownProps {
  zones: { id: string; name: string }[];
  selectedZoneId: string;
}

export function ZoneSelectorDropdown({ zones, selectedZoneId }: ZoneSelectorDropdownProps) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
      <select
        value={selectedZoneId}
        onChange={(e) =>
          router.push(e.target.value ? `/abonnements?zone=${e.target.value}` : "/abonnements")
        }
        className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer"
      >
        <option value="">Toutes les zones</option>
        {zones.map((z) => (
          <option key={z.id} value={z.id}>
            {z.name}
          </option>
        ))}
      </select>
    </div>
  );
}
