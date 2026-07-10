import { requireRole } from "@/lib/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { NouveauDirectMatchForm } from "./nouveau-direct-match-form";

export const metadata = { title: "Nouveau match direct — Fondateur" };

export default async function FondateurNouveauDirectMatchPage() {
  await requireRole(["fondateur"]);

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/fondateur/matchs?tab=direct">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Retour
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold font-heading">Nouveau match direct</h1>
          <p className="text-muted-foreground text-sm">Match inter-zones sans zone associée</p>
        </div>
      </div>

      <NouveauDirectMatchForm />
    </div>
  );
}
