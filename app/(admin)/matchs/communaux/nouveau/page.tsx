import { requireRole } from "@/lib/auth";
import { NouveauInterMatchForm } from "../../nouveau-inter-form";

export const metadata = { title: "Nouveau match communal" };

export default async function NouveauMatchCommunalPage() {
  await requireRole(["super_admin"]);
  return (
    <NouveauInterMatchForm
      matchType="Match Communal"
      backHref="/matchs?tab=communaux"
      title="Nouveau match communal"
    />
  );
}
