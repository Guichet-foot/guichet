import { requireRole } from "@/lib/auth";
import { getFinishedMatches, getMatchUnsoldMap } from "@/lib/actions/invendus-actions";
import { InvendusList } from "./invendus-list";
import { PackageX } from "lucide-react";

export const metadata = { title: "Invendus" };

export default async function InvendusPage() {
  await requireRole(["super_admin", "admin_zone", "c3"]);

  const matches = await getFinishedMatches();
  const matchIds = matches.map((m: { id: string }) => m.id);
  const unsoldMap = await getMatchUnsoldMap(matchIds);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
          <PackageX className="h-6 w-6 text-red-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-heading">Invendus</h1>
          <p className="text-muted-foreground text-sm">Déclarez les billets invendus après chaque match</p>
        </div>
      </div>

      <InvendusList matches={matches} unsoldMap={unsoldMap} />
    </div>
  );
}
