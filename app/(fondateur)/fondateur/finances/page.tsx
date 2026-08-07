import { requireRole } from "@/lib/auth";
import { getFinancesData } from "@/lib/actions/finances-actions";
import { FinancesTable } from "./finances-table";
import { Wallet } from "lucide-react";

export const metadata = { title: "Finances — Fondateur" };

export default async function FinancesPage() {
  await requireRole(["fondateur"]);
  const rows = await getFinancesData();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
          <Wallet className="h-6 w-6 text-green-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-heading">Finances</h1>
          <p className="text-muted-foreground text-sm">
            Suivi des frais de billetterie par match · {rows.length} enregistrement{rows.length > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <FinancesTable rows={rows} />
    </div>
  );
}
