import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Équipes — Fondateur" };

/* eslint-disable @typescript-eslint/no-explicit-any */

const CARDS_PER_PAGE = 8;

function TeamColorSwatches({ colors }: { colors: string }) {
  try {
    const parsed = JSON.parse(colors);
    const off = parsed.official || [];
    const sub = parsed.substitute || [];
    return (
      <span className="inline-flex items-center gap-1.5">
        {off.length === 2 && (
          <span
            className="inline-block w-5 h-5 rounded border border-border shrink-0"
            style={{ background: `linear-gradient(135deg, ${off[0]} 50%, ${off[1]} 50%)` }}
            title="Officielle"
          />
        )}
        {sub.length === 2 && (
          <span
            className="inline-block w-5 h-5 rounded border border-border shrink-0"
            style={{ background: `linear-gradient(135deg, ${sub[0]} 50%, ${sub[1]} 50%)` }}
            title="Substitution"
          />
        )}
      </span>
    );
  } catch {
    return <span className="text-xs text-muted-foreground">{colors}</span>;
  }
}

export default async function FondateurEquipesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireRole(["fondateur"]);
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1") || 1);

  const adminClient = await createAdminClient();

  const { data: zonesRaw } = await adminClient
    .from("zones")
    .select("id, name, president, logo, teams(id, name, colors)")
    .order("name");

  type ZoneWithTeams = {
    id: string;
    name: string;
    president: string | null;
    logo: string | null;
    teams: { id: string; name: string; colors: string | null }[];
  };

  const zones = (zonesRaw || []) as ZoneWithTeams[];

  const totalPages = Math.max(1, Math.ceil(zones.length / CARDS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * CARDS_PER_PAGE;
  const pageZones = zones.slice(start, start + CARDS_PER_PAGE);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
          <Shield className="h-6 w-6 text-indigo-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-heading">Équipes</h1>
          <p className="text-muted-foreground text-sm">
            {zones.length} zone{zones.length !== 1 ? "s" : ""} ·{" "}
            {zones.reduce((s, z) => s + z.teams.length, 0)} équipe{zones.reduce((s, z) => s + z.teams.length, 0) !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {zones.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <MapPin className="h-16 w-16 mb-4 opacity-30" />
          <p className="text-lg">Aucune zone</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {pageZones.map((zone) => (
              <Card key={zone.id} className="overflow-hidden">
                {/* Zone header */}
                <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50 border-b border-indigo-100">
                  {zone.logo ? (
                    <img src={zone.logo} alt={zone.name} className="w-8 h-8 rounded object-cover border" />
                  ) : (
                    <div className="w-8 h-8 rounded bg-indigo-200 flex items-center justify-center shrink-0">
                      <MapPin className="h-4 w-4 text-indigo-700" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-indigo-900 truncate block">{zone.name}</span>
                  </div>
                  {zone.president && (
                    <span className="text-xs text-indigo-600 shrink-0 hidden sm:block truncate max-w-[120px]">
                      {zone.president}
                    </span>
                  )}
                </div>

                {/* Teams */}
                <CardContent className="p-0">
                  {zone.teams.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Aucune équipe</p>
                  ) : (
                    <div className="divide-y divide-border">
                      {zone.teams.map((team) => (
                        <div key={team.id} className="flex items-center justify-between px-4 py-2.5">
                          <span className="text-sm font-medium truncate">{team.name}</span>
                          {team.colors && <TeamColorSwatches colors={team.colors} />}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <Link href={`/fondateur/equipes?page=${safePage - 1}`} aria-disabled={safePage <= 1}>
                <Button variant="outline" size="sm" disabled={safePage <= 1}>
                  <ChevronLeft className="h-4 w-4" />
                  Précédent
                </Button>
              </Link>
              <span className="text-sm text-muted-foreground">
                Page {safePage} / {totalPages}
              </span>
              <Link href={`/fondateur/equipes?page=${safePage + 1}`} aria-disabled={safePage >= totalPages}>
                <Button variant="outline" size="sm" disabled={safePage >= totalPages}>
                  Suivant
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
