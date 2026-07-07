import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Trophy } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Matchs — Fondateur" };

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function FondateurMatchsPage() {
  await requireRole(["fondateur"]);
  const adminClient = await createAdminClient();

  const { data: zones } = await adminClient
    .from("zones")
    .select("id, name, region, president, logo")
    .order("name");

  const zoneList = (zones || []) as {
    id: string; name: string; region: string | null;
    president: string | null; logo: string | null;
  }[];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center">
          <Trophy className="h-6 w-6 text-brand" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-heading">Matchs</h1>
          <p className="text-muted-foreground text-sm">Sélectionnez une zone</p>
        </div>
      </div>

      {zoneList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <MapPin className="h-16 w-16 mb-4 opacity-30" />
          <p className="text-lg">Aucune zone</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {zoneList.map((zone) => (
            <Link key={zone.id} href={`/fondateur/matchs/${zone.id}`}>
              <Card className="cursor-pointer hover:border-brand/50 hover:shadow-md transition-all">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    {zone.logo ? (
                      <img src={zone.logo} alt={zone.name} className="w-12 h-12 rounded-lg object-cover border" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
                        <MapPin className="h-6 w-6 text-brand" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="font-semibold text-lg truncate">{zone.name}</h3>
                      {zone.region && <p className="text-sm text-muted-foreground">{zone.region}</p>}
                      {zone.president && (
                        <p className="text-xs text-muted-foreground mt-1">Président : {zone.president}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
