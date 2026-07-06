import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users } from "lucide-react";
import { formatFCFA } from "@/lib/format";
import { CreateSuperAdminForm } from "./create-super-admin-form";
import { SuperAdminActions } from "./super-admin-actions";
import { SAFilters } from "./sa-filters";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";

export const metadata = { title: "Super Admins" };

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function SuperAdminsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const profile = await requireRole(["fondateur"]);
  const supabase = await createAdminClient();

  const { data: superAdmins } = await supabase
    .from("profiles")
    .select("id, full_name, phone, active, created_at")
    .eq("role", "super_admin")
    .eq("created_by_admin", profile.id)
    .order("created_at", { ascending: false });

  // Get emails from auth
  const emails: Record<string, string> = {};
  if (superAdmins) {
    for (const sa of superAdmins) {
      const { data: authUser } = await supabase.auth.admin.getUserById(sa.id);
      if (authUser?.user?.email) emails[sa.id] = authUser.user.email;
    }
  }

  // Get zones count and revenue per super_admin
  const stats: Record<string, { zones: number; revenue: number }> = {};
  if (superAdmins) {
    for (const sa of superAdmins) {
      const { count } = await supabase
        .from("zones")
        .select("*", { count: "exact", head: true })
        .eq("created_by", sa.id);

      const { data: zones } = await supabase.from("zones").select("id").eq("created_by", sa.id);
      const zoneIds = zones?.map((z: any) => z.id) || [];
      let revenue = 0;

      if (zoneIds.length > 0) {
        const { data: tickets } = await supabase
          .from("tickets")
          .select("price, match:matches(zone_id)")
          .eq("counts_as_revenue", true) as { data: any[] | null };

        revenue = tickets
          ?.filter((t: any) => zoneIds.includes(t.match?.zone_id))
          .reduce((sum: number, t: any) => sum + t.price, 0) || 0;
      }

      stats[sa.id] = { zones: count || 0, revenue };
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-heading">Super Admins</h1>
          <p className="text-muted-foreground">{superAdmins?.length || 0} compte(s)</p>
        </div>
        <CreateSuperAdminForm />
      </div>

      <SAFilters />

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {(() => {
            const searchQ = params.q?.toLowerCase() || "";
            const filtered = searchQ
              ? superAdmins?.filter((sa: any) => sa.full_name.toLowerCase().includes(searchQ))
              : superAdmins;
            return !filtered || filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mb-4" />
              <p>Aucun super admin créé</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead className="hidden sm:table-cell">Téléphone</TableHead>
                  <TableHead className="text-center">Zones</TableHead>
                  <TableHead className="text-right">Recettes</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((sa: any) => {
                  const s = stats[sa.id] || { zones: 0, revenue: 0 };
                  return (
                    <TableRow key={sa.id}>
                      <TableCell className="font-semibold">{sa.full_name}</TableCell>
                      <TableCell className="hidden sm:table-cell">{sa.phone || "—"}</TableCell>
                      <TableCell className="text-center">{s.zones}</TableCell>
                      <TableCell className="text-right font-bold text-brand">{formatFCFA(s.revenue)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={sa.active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                          {sa.active ? "Actif" : "Suspendu"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <SuperAdminActions userId={sa.id} active={sa.active} name={sa.full_name} phone={sa.phone} email={emails[sa.id]} />
                          <Link href={`/fondateur/super-admins/${sa.id}`}>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <Eye className="h-3 w-3" />
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
