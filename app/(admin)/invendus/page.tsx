import { requireRole } from "@/lib/auth";
import { getBilleterieInvendusList } from "@/lib/actions/billeterie-actions";
import { BilleterieInvendusList } from "@/app/(fondateur)/fondateur/invendus/billeterie-invendus";
import { PackageX } from "lucide-react";

export const metadata = { title: "Invendus" };

export default async function InvendusPage() {
  const profile = await requireRole(["super_admin", "admin_zone", "c3", "president_odcav", "tresorier"]);
  const items = await getBilleterieInvendusList();

  const canAssign =
    profile.role === "super_admin" ||
    profile.role === "president_odcav" ||
    profile.role === "tresorier";

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
          <PackageX className="h-6 w-6 text-red-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-heading">Invendus — Billetterie</h1>
          <p className="text-muted-foreground text-sm">
            Billets de passes multi-matchs non scannés
          </p>
        </div>
      </div>
      <BilleterieInvendusList items={items} canAssign={canAssign} />
    </div>
  );
}
