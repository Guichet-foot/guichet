import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS, ROLE_COLORS } from "@/lib/constants";
import { CreateFondateurUserForm } from "./create-fondateur-user-form";
import { SubUserActions } from "./sub-user-actions";
import { UserCog, ShieldCheck, CheckCircle2, XCircle } from "lucide-react";

export default async function UtilisateursPage() {
  const profile = await requireRole(["fondateur"]);

  const adminClient = await createAdminClient();
  const { data: subUsers } = await adminClient
    .from("profiles")
    .select("id, full_name, phone, role, active, permitted_modules, created_at")
    .eq("created_by_admin", profile.id)
    .in("role", ["assistant_fondateur", "billetterie_fondateur"])
    .order("created_at", { ascending: false });

  const { data: authData } = await adminClient.auth.admin.listUsers({ perPage: 1000, page: 1 });
  const emailMap: Record<string, string> = {};
  for (const u of authData?.users ?? []) emailMap[u.id] = u.email ?? "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-xl">
            <UserCog className="h-6 w-6 text-amber-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-ink">Utilisateurs</h1>
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
