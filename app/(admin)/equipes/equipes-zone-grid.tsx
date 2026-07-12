"use client";

import { usePathname, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, FileDown } from "lucide-react";
import Link from "next/link";

interface ZoneCardProps {
  id: string;
  name: string;
  region?: string | null;
  president?: string | null;
  logo?: string | null;
}

export function EquipesZoneGrid({ zones }: { zones: ZoneCardProps[] }) {
  const pathname = usePathname();
  const router = useRouter();

  if (zones.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <MapPin className="h-16 w-16 mb-4 opacity-30" />
        <p className="text-lg">Aucune zone</p>
        <p className="text-sm">Créez une zone dans le module Zones</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Équipes</h1>
          <p className="text-muted-foreground">Sélectionnez une zone</p>
        </div>
        <Link
          href="/api/reports/teams"
          target="_blank"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-green-700 text-white text-sm font-medium hover:bg-green-800 transition-colors"
        >
          <FileDown className="h-4 w-4" />
          PDF toutes les zones
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {zones.map((zone) => (
          <Card
            key={zone.id}
            className="cursor-pointer hover:border-brand/50 hover:shadow-md transition-all"
            onClick={() => router.push(`${pathname}?zone=${zone.id}`)}
          >
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start gap-3">
                {zone.logo ? (
                  <img
                    src={zone.logo}
                    alt={zone.name}
                    className="w-12 h-12 rounded-lg object-cover border shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
                    <MapPin className="h-6 w-6 text-brand" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-lg truncate">{zone.name}</h3>
                  {zone.region && (
                    <p className="text-sm text-muted-foreground">{zone.region}</p>
                  )}
                  {zone.president && (
                    <p className="text-xs text-muted-foreground mt-1">Président : {zone.president}</p>
                  )}
                </div>
              </div>

              {/* Per-zone PDF button */}
              <div className="mt-3 flex justify-end">
                <Link
                  href={`/api/reports/teams?zone=${zone.id}`}
                  target="_blank"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors"
                >
                  <FileDown className="h-3 w-3" />
                  PDF cette zone
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
