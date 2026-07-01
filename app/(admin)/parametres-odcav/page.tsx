import { requireRole } from "@/lib/auth";
import { getOdcavSettings } from "@/lib/actions/odcav-actions";
import { OdcavSettingsForm } from "./odcav-settings-form";
import { Building2 } from "lucide-react";

export const metadata = { title: "Paramètre ODCAV" };

export default async function ParametresOdcavPage() {
  await requireRole(["super_admin", "fondateur"]);
  const settings = await getOdcavSettings();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
          <Building2 className="h-6 w-6 text-brand" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-heading">Paramètre ODCAV</h1>
          <p className="text-sm text-muted-foreground">
            Ces informations apparaîtront sur les rapports PDF générés
          </p>
        </div>
      </div>

      <OdcavSettingsForm initialData={settings} />
    </div>
  );
}
