"use client";

import { usePathname, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin } from "lucide-react";

interface ZoneCardProps {
  id: string;
  name: string;
  region?: string | null;
  president?: string | null;
  logo?: string | null;
}

interface ZoneCardGridProps {
  zones: ZoneCardProps[];
  title: string;
}

export function ZoneCardGrid({ zones, title }: ZoneCardGridProps) {
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
      <h1 className="text-2xl font-bold font-heading">{title}</h1>
      <p className="text-muted-foreground">Sélectionnez une zone</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {zones.map((zone) => (
          <Card
            key={zone.id}
            className="cursor-pointer hover:border-brand/50 hover:shadow-md transition-all"
            onClick={() => router.push(`${pathname}?zone=${zone.id}`)}
          >
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                {zone.logo ? (
                  <img
                    src={zone.logo}
                    alt={zone.name}
                    className="w-12 h-12 rounded-lg object-cover border"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
                    <MapPin className="h-6 w-6 text-brand" />
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="font-semibold text-lg truncate">{zone.name}</h3>
                  {zone.region && (
                    <p className="text-sm text-muted-foreground">{zone.region}</p>
                  )}
                  {zone.president && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Président : {zone.president}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
