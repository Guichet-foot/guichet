import { requireRole } from "@/lib/auth";
import { getOdcavSettings } from "@/lib/actions/odcav-actions";
import { OdcavSettingsForm } from "../parametres-odcav/odcav-settings-form";
import { Network } from "lucide-react";

export const metadata = { title: "Paramètre C3" };

export default async function ParametresC3Page() {
  await requireRole(["c3"]);
  const settings = await getOdcavSettings();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
          <Network className="h-6 w-6 text-brand" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-heading">Paramètre C3</h1>
          <p className="text-sm text-muted-foreground">
            Ces informations apparaîtront sur les rapports PDF générés
          </p>
        </div>
      </div>

      <OdcavSettingsForm initialData={settings} showLogo={false} entityLabel="ASC" />
    </div>
  );
}
