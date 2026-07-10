import { requireRole } from "@/lib/auth";
import { NouveauInterMatchFondateurForm } from "../../nouveau-inter-form-fondateur";

export const metadata = { title: "Nouveau match départemental — Fondateur" };

export default async function FondateurNouveauMatchDepartementalPage() {
  await requireRole(["fondateur"]);
  return (
    <NouveauInterMatchFondateurForm
      matchType="Match Départemental"
      backHref="/fondateur/matchs/departementaux"
      title="Nouveau match départemental"
    />
  );
}
