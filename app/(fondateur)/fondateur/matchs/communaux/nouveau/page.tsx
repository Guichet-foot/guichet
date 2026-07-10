import { requireRole } from "@/lib/auth";
import { NouveauInterMatchFondateurForm } from "../../nouveau-inter-form-fondateur";

export const metadata = { title: "Nouveau match communal — Fondateur" };

export default async function FondateurNouveauMatchCommunalPage() {
  await requireRole(["fondateur"]);
  return (
    <NouveauInterMatchFondateurForm
      matchType="Match Communal"
      backHref="/fondateur/matchs/communaux"
      title="Nouveau match communal"
    />
  );
}
