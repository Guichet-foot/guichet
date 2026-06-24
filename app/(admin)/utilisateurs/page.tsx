import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Users } from "lucide-react";
import { ROLE_LABELS, ROLE_COLORS } from "@/lib/constants";
import { ToggleActiveButton } from "./toggle-active-button";

export const metadata = { title: "Utilisateurs" };

export default async function UsersPage() {
  const profile = await requireRole(["super_admin", "admin_zone"]);
  const supabase = await createClient();

  const query = supabase
    .from("profiles")
    .select("*, zone:zones(name)")
    .order("created_at", { ascending: false });

  if (profile.role === "admin_zone") {
    query.eq("zone_id", profile.zone_id!);
  }

  const { data: users } = await query;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Utilisateurs</h1>
          <p className="text-muted-foreground">
            {users?.length || 0} utilisateur(s)
          </p>
        </div>
        {profile.role === "super_admin" && (
          <Link href="/utilisateurs/nouveau">
            <Button className="bg-brand hover:bg-brand/90">
              <Plus className="h-4 w-4 mr-2" />
              Nouveau
            </Button>
          </Link>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {!users || users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mb-4" />
              <p>Aucun utilisateur</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead className="hidden sm:table-cell">Téléphone</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead className="hidden md:table-cell">Zone</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.full_name}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {user.phone || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={ROLE_COLORS[user.role]}
                      >
                        {ROLE_LABELS[user.role]}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {user.zone?.name || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={user.active ? "default" : "destructive"}
                        className={
                          user.active
                            ? "bg-success/10 text-success"
                            : ""
                        }
                      >
                        {user.active ? "Actif" : "Inactif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {profile.role === "super_admin" &&
                        user.id !== profile.id && (
                          <ToggleActiveButton
                            userId={user.id}
                            active={user.active}
                          />
                        )}
                    </TableCell>
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
