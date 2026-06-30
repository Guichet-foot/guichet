import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings2, History } from "lucide-react";
import { PlatformFeeForm } from "./platform-fee-form";
import { formatFCFA, formatDate } from "@/lib/format";

export const metadata = { title: "Paramètres Plateforme" };

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function ParametresFondateurPage() {
  await requireRole(["fondateur"]);
  const supabase = await createAdminClient();

  const today = new Date().toISOString().split("T")[0];

  const { data: current } = await supabase
    .from("platform_settings")
    .select("*")
    .lte("effective_date", today)
    .order("effective_date", { ascending: false })
    .limit(1)
    .single();

  const { data: history } = await supabase
    .from("platform_settings")
    .select("*")
    .order("effective_date", { ascending: false });

  const currentFee = current?.frais_plateforme ?? 5000;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
          <Settings2 className="h-6 w-6 text-amber-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-heading">Paramètres plateforme</h1>
          <p className="text-muted-foreground text-sm">Gestion des frais et commissions</p>
        </div>
      </div>

      {/* Affichage paramètres actuels */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Frais plateforme</p>
              <p className="text-2xl font-bold text-amber-700">{formatFCFA(currentFee)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">par jour d&apos;activité</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Commission ODCAV</p>
              <p className="text-2xl font-bold text-blue-700">5%</p>
              <p className="text-xs text-muted-foreground mt-0.5">des recettes brutes (fixe)</p>
            </div>
          </div>
          {current?.effective_date && (
            <p className="text-xs text-muted-foreground mt-4 border-t border-amber-200 pt-3">
              En vigueur depuis le {formatDate(current.effective_date)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Formulaire modification */}
      <PlatformFeeForm currentFee={currentFee} />

      {/* Historique */}
      {history && history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4" />
              Historique des modifications
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-4 py-3 text-left font-medium">Date d&apos;effet</th>
                    <th className="px-4 py-3 text-right font-medium">Frais / jour</th>
                    <th className="px-4 py-3 text-right font-medium">ODCAV</th>
                  </tr>
                </thead>
                <tbody>
                  {(history as any[]).map((h: any, i: number) => (
                    <tr key={h.id} className={`border-b last:border-0 ${i === 0 ? "bg-amber-50/50 font-medium" : ""}`}>
                      <td className="px-4 py-3">
                        {formatDate(h.effective_date)}
                        {i === 0 && <span className="ml-2 text-xs bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded">Actuel</span>}
                      </td>
                      <td className="px-4 py-3 text-right">{formatFCFA(h.frais_plateforme)}</td>
                      <td className="px-4 py-3 text-right">{(h.odcav_rate * 100).toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
