import { requireRole } from "@/lib/auth";
import { getBilleterieList } from "@/lib/actions/billeterie-actions";
import { FondateurBilleterieList } from "./billeterie-list-client";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Billetterie — Fondateur" };

export default async function FondateurBilletteriePage() {
  await requireRole(["fondateur"]);
  const items = await getBilleterieList();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Billetterie</h1>
          <p className="text-muted-foreground">
            {items.length} pass multi-matchs créé{items.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/fondateur/billeterie/nouveau">
          <Button className="bg-brand hover:bg-brand/90">
            <Plus className="h-4 w-4 mr-2" />
            Nouveau pass
          </Button>
        </Link>
      </div>

      <FondateurBilleterieList items={items} />
    </div>
  );
}
