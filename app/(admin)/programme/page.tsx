import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, Eye } from "lucide-react";
import { CreateTournamentDialog } from "./create-tournament-dialog";

export const metadata = { title: "Programme" };

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function ProgrammePage() {
  const profile = await requireRole(["super_admin", "admin_zone"]);
  const supabase = await createClient();

  let query = supabase
    .from("tournaments")
    .select("*")
    .order("created_at", { ascending: false });

  if (profile.role === "admin_zone") {
    query = query.eq("zone_id", profile.zone_id!);
  }

  const { data: tournaments } = await query;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Programme</h1>
          <p className="text-muted-foreground">
            Tournois et saisons
          </p>
        </div>
        <CreateTournamentDialog zoneId={profile.zone_id} />
      </div>

      {!tournaments || tournaments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CalendarDays className="h-12 w-12 mx-auto mb-4" />
            <p>Aucun tournoi créé</p>
            <p className="text-sm mt-1">Créez votre premier tournoi pour commencer</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {tournaments.map((t: any) => (
            <Card key={t.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{t.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      Saison {t.season}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="secondary"
                      className={
                        t.status === "en_cours"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }
                    >
                      {t.status === "en_cours" ? "En cours" : "Terminé"}
                    </Badge>
                    <Link href={`/programme/${t.id}`}>
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-1" />
                        Gérer
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
