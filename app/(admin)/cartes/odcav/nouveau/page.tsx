import { requireRole } from "@/lib/auth";
import { OdcavCardForm } from "./odcav-card-form";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Nouvelle carte ODCAV" };

export default async function NouvelleCarteOdcavPage() {
  await requireRole(["super_admin"]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/cartes?view=odcav">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />Retour
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold font-heading">Nouvelle carte ODCAV</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Créez une carte d&apos;accès pour un membre de l&apos;ODCAV
          </p>
        </div>
      </div>
      <OdcavCardForm />
    </div>
  );
}
