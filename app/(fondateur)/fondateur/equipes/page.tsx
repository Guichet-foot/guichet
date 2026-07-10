import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { Shield } from "lucide-react";
import { EquipesManager } from "./equipes-manager";

export const metadata = { title: "Équipes — Fondateur" };

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function FondateurEquipesPage() {
  await requireRole(["fondateur"]);

  const adminClient = await createAdminClient();

  const { data: zonesRaw } = await adminClient
    .from("zones")
    .select("id, name, president, logo, teams(id, name, colors, president, delegates)")
    .order("name");

  const zones = (zonesRaw || []) as {
    id: string;
    name: string;
    president: string | null;
    logo: string | null;
    teams: { id: string; name: string; colors: string | null; president: string | null; delegates: string[] | null }[];
  }[];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
          <Shield className="h-6 w-6 text-indigo-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-heading">Équipes</h1>
        </div>
      </div>

      <EquipesManager zones={zones} />
    </div>
  );
}
