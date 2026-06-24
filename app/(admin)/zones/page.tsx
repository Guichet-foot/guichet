import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
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

export const metadata = { title: "Zones" };

export default async function ZonesPage() {
  await requireRole(["super_admin"]);
  const supabase = await createClient();

  const { data: zones } = await supabase
    .from("zones")
    .select("*")
    .order("name");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Zones</h1>
          <p className="text-muted-foreground">
            {zones?.length || 0} zone(s)
          </p>
        </div>
        <CreateZoneForm />
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {zones.map((zone) => (
                  <TableRow key={zone.id}>
                    <TableCell className="font-medium">{zone.name}</TableCell>
                    <TableCell>{zone.region || "—"}</TableCell>
                    <TableCell>{formatDate(zone.created_at)}</TableCell>
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
