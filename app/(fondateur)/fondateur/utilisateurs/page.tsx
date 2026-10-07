import { requireRole } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getEffectiveZone } from "@/lib/get-effective-zone";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROLE_LABELS, ROLE_COLORS } from "@/lib/constants";
import { buildZoneUrl } from "@/lib/zone-utils";
import { CreateFondateurUserForm } from "./create-fondateur-user-form";
import { SubUserActions } from "./sub-user-actions";
import { UserActions } from "@/app/(admin)/utilisateurs/user-actions";
import { ZoneCardGrid } from "@/components/zone-card-grid";
import { ZoneBackHeader } from "@/components/zone-back-header";
import {
  UserCog,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Crown,
  MapPin,
  Network,
  Plus,
  Users,
} from "lucide-react";

export const metadata = { title: "Utilisateurs" };

async function buildEmailMap(adminClient: Awaited<ReturnType<typeof createAdminClient>>) {
  const { data } = await adminClient.auth.admin.listUsers({ perPage: 1000, page: 1 });
  const map: Record<string, string> = {};
  for (const u of data?.users ?? []) map[u.id] = u.email ?? "";
  return map;
}

export default async function UtilisateursPage({
  searchParams,
}: {
  searchParams: Promise<{ zone?: string; tab?: string }>;
}) {
  const profile = await requireRole(["fondateur"]);
  // Gestion des comptes Zones/ODCAV/C3 réservée au fondateur lui-même
  // (requireRole élargit aussi aux sous-comptes assistant/billetterie).
  if (profile.role !== "fondateur") {
    redirect("/fondateur/dashboard");
  }
  const params = await searchParams;
  const activeTab: "zones" | "directs" | "team" =
    params.tab === "directs" ? "directs" : params.tab === "team" ? "team" : "zones";

  // ── "Mon équipe" tab — fondateur's own assistant/billetterie sub-accounts ──
  if (activeTab === "team") {
    const adminClient = await createAdminClient();
    const { data: subUsers } = await adminClient
      .from("profiles")
      .select("id, full_name, phone, role, active, permitted_modules, created_at")
      .eq("created_by_admin", profile.id)
      .in("role", ["assistant_fondateur", "billetterie_fondateur"])
      .order("created_at", { ascending: false });

    const emailMap = await buildEmailMap(adminClient);

    return (
      <div className="space-y-6">
        <TabBar active="team" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-xl">
              <UserCog className="h-6 w-6 text-amber-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-ink">Mon équipe</h1>
              <p className="text-sm text-ink/60">Gérez vos comptes assistants et billetterie</p>
            </div>
          </div>
          <CreateFondateurUserForm />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-amber-600" />
              Sous-comptes ({subUsers?.length ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!subUsers || subUsers.length === 0 ? (
              <div className="p-8 text-center text-ink/50">
                <UserCog className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Aucun utilisateur créé pour le moment</p>
              </div>
            ) : (
              <div className="divide-y">
                {subUsers.map((u) => {
                  const modules: string[] = u.permitted_modules ?? [];
                  return (
                    <div key={u.id} className="flex items-start justify-between p-4 gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-ink">{u.full_name}</span>
                          <Badge className={ROLE_COLORS[u.role] || "bg-gray-100 text-gray-800"}>
                            {ROLE_LABELS[u.role] || u.role}
                          </Badge>
                          {u.active ? (
                            <span className="flex items-center gap-1 text-xs text-green-600">
                              <CheckCircle2 className="h-3 w-3" /> Actif
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-red-500">
                              <XCircle className="h-3 w-3" /> Désactivé
                            </span>
                          )}
                        </div>
                        {emailMap[u.id] && <p className="text-sm text-ink/60 mt-0.5">{emailMap[u.id]}</p>}
                        {u.phone && <p className="text-sm text-ink/60 mt-0.5">{u.phone}</p>}
                        {modules.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {modules.map((m) => (
                              <span key={m} className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5">
                                {m}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <SubUserActions userId={u.id} isActive={u.active} />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── "ODCAV / C3" tab — global accounts (président ODCAV, super admin, trésorier, C3) ──
  if (activeTab === "directs") {
    const adminClient = await createAdminClient();
    const { data: directUsers } = await adminClient
      .from("profiles")
      .select("*")
      .in("role", ["president_odcav", "super_admin", "tresorier", "c3"])
      .order("role", { ascending: true })
      .order("created_at", { ascending: false });

    const emailMap = await buildEmailMap(adminClient);

    return (
      <div className="space-y-6">
        <TabBar active="directs" />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-heading">Comptes ODCAV / C3</h1>
            <p className="text-muted-foreground">{directUsers?.length || 0} compte(s)</p>
          </div>
          <Link href="/fondateur/utilisateurs/nouveau?tab=directs">
            <Button className="bg-brand hover:bg-brand/90">
              <Plus className="h-4 w-4 mr-2" />
              Nouveau
            </Button>
          </Link>
        </div>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            {!directUsers || directUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Network className="h-12 w-12 mb-4" />
                <p>Aucun compte créé</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead className="hidden md:table-cell">Email</TableHead>
                    <TableHead className="hidden sm:table-cell">Téléphone</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(directUsers as any[]).map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.full_name}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{emailMap[user.id] || "—"}</TableCell>
                      <TableCell className="hidden sm:table-cell">{user.phone || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={ROLE_COLORS[user.role]}>
                          {ROLE_LABELS[user.role]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={user.active ? "default" : "destructive"}
                          className={user.active ? "bg-success/10 text-success" : ""}
                        >
                          {user.active ? "Actif" : "Inactif"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <UserActions
                          user={{
                            id: user.id,
                            full_name: user.full_name,
                            email: emailMap[user.id] || "",
                            phone: user.phone,
                            role: user.role,
                            active: user.active,
                            is_president: user.is_president ?? false,
                            permitted_modules: user.permitted_modules ?? null,
                            password_duration_minutes: (user as any).password_duration_minutes ?? null,
                          }}
                          currentUserId={profile.id}
                          currentUserRole={profile.role}
                          currentUserIsPresident={profile.is_president ?? false}
                          c3ZoneIds={(user as any).c3_zone_ids || []}
                        />
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

  // ── "Zones" tab (default) — admin_zone / portier / caissier accounts per zone ──
  const { effectiveZoneId, selectedZone, ownedZones, needsZoneSelection } =
    await getEffectiveZone(profile, params.zone);

  if (needsZoneSelection) {
    return (
      <div className="space-y-6">
        <TabBar active="zones" />
        <ZoneCardGrid zones={ownedZones} title="Utilisateurs" />
      </div>
    );
  }

  const supabase = await createClient();
  const { data: users } = await supabase
    .from("profiles")
    .select("*, zone:zones!profiles_zone_id_fkey(name)")
    .eq("zone_id", effectiveZoneId as string)
    .order("created_at", { ascending: false });

  const adminClientForEmails = await createAdminClient();
  const emailMap = await buildEmailMap(adminClientForEmails);

  return (
    <div className="space-y-6">
      {!params.zone && <TabBar active="zones" />}
      {selectedZone && <ZoneBackHeader zoneName={selectedZone.name} />}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Utilisateurs</h1>
          <p className="text-muted-foreground">{users?.length || 0} utilisateur(s)</p>
        </div>
        <Link href={buildZoneUrl("/fondateur/utilisateurs/nouveau", params.zone)}>
          <Button className="bg-brand hover:bg-brand/90">
            <Plus className="h-4 w-4 mr-2" />
            Nouveau
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
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
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead className="hidden sm:table-cell">Téléphone</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(users as any[]).map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{emailMap[user.id] || "—"}</TableCell>
                    <TableCell className="hidden sm:table-cell">{user.phone || "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="secondary" className={ROLE_COLORS[user.role]}>
                          {ROLE_LABELS[user.role]}
                        </Badge>
                        {user.is_president && (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-300 gap-1">
                            <Crown className="h-3 w-3" />
                            Président
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={user.active ? "default" : "destructive"}
                        className={user.active ? "bg-success/10 text-success" : ""}
                      >
                        {user.active ? "Actif" : "Inactif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <UserActions
                        user={{
                          id: user.id,
                          full_name: user.full_name,
                          email: emailMap[user.id] || "",
                          phone: user.phone,
                          role: user.role,
                          active: user.active,
                          is_president: user.is_president ?? false,
                          permitted_modules: user.permitted_modules ?? null,
                          password_duration_minutes: (user as any).password_duration_minutes ?? null,
                        }}
                        currentUserId={profile.id}
                        currentUserRole={profile.role}
                        currentUserIsPresident={profile.is_president ?? false}
                      />
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

function TabBar({ active }: { active: "zones" | "directs" | "team" }) {
  const tabs: { key: "zones" | "directs" | "team"; href: string; icon: typeof MapPin; label: string }[] = [
    { key: "zones", href: "/fondateur/utilisateurs", icon: MapPin, label: "Zones" },
    { key: "directs", href: "/fondateur/utilisateurs?tab=directs", icon: Network, label: "ODCAV / C3" },
    { key: "team", href: "/fondateur/utilisateurs?tab=team", icon: UserCog, label: "Mon équipe" },
  ];
  return (
    <div className="flex gap-1 border-b">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            active === tab.key
              ? "border-brand text-brand"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <tab.icon className="h-4 w-4" />
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
