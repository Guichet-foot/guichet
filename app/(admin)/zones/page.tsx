import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MapPin } from "lucide-react";
import { formatDate } from "@/lib/format";
import { CreateZoneForm } from "./create-zone-form";
import { ZoneRowActions } from "./zone-row-actions";

export const metadata = { title: "Zones" };

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function ZonesPage() {
  const profile = await requireRole(["super_admin", "president_odcav", "tresorier"]);
  const adminClient = await createAdminClient();

  // super_admin and president_odcav see ALL zones (shared pool)
  const isGlobalRole = profile.role === "super_admin" || profile.role === "president_odcav";
  const ownerIds = [...new Set(
    [profile.id, (profile as any).created_by_admin].filter(Boolean) as string[]
  )];

  const zonesQuery = isGlobalRole
    ? adminClient.from("zones").select("*").order("name")
    : adminClient.from("zones").select("*").in("created_by", ownerIds).order("name");

  const { data: zones } = await zonesQuery;

  const canCreateZone = profile.role !== "tresorier";
  const canEditZone = profile.role !== "tresorier";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Zones</h1>
          <p className="text-muted-foreground">
            {zones?.length || 0} zone(s)
          </p>
        </div>
        {canCreateZone && <CreateZoneForm />}
      </div>

      <Card>
        <CardContent className="p-0">
          {!zones || zones.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <MapPin className="h-12 w-12 mb-4" />
              <p>Aucune zone créée</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Région</TableHead>
                  <TableHead>Créée le</TableHead>
                  {canEditZone && <TableHead className="w-20" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {zones.map((zone) => (
                  <TableRow key={zone.id}>
                    <TableCell className="font-medium">{zone.name}</TableCell>
                    <TableCell>{zone.region || "—"}</TableCell>
                    <TableCell>{formatDate(zone.created_at)}</TableCell>
                    {canEditZone && (
                      <TableCell>
                        <ZoneRowActions zone={{ id: zone.id, name: zone.name, region: zone.region ?? null }} />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
