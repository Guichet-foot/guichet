import { requireRole } from "@/lib/auth";
import { NouveauInterMatchForm } from "../../nouveau-inter-form";

export const metadata = { title: "Nouveau match départemental" };

export default async function NouveauMatchDepartementalPage() {
  await requireRole(["super_admin", "fondateur"]);
  return (
    <NouveauInterMatchForm
      matchType="Match Départemental"
      backHref="/matchs/departementaux"
      title="Nouveau match départemental"
    />
  );
}
