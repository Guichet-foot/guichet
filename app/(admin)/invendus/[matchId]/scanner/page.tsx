import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { InvendusScanner } from "./invendus-scanner";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Scanner Invendus" };

export default async function InvendusScannerPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  await requireRole(["super_admin", "admin_zone"]);
  const { matchId } = await params;
  const supabase = await createAdminClient();

  const { data: match } = await supabase
    .from("matches")
    .select("id, home_team, away_team, match_date")
    .eq("id", matchId)
    .single();

  if (!match) notFound();

  // Count already scanned as invendu (annule) for this match
  const { count } = await supabase
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("match_id", matchId)
    .eq("status", "annule");

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/invendus">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />Retour
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold font-heading">Scanner Invendus</h1>
          <p className="text-sm text-muted-foreground">
            {match.home_team} vs {match.away_team}
          </p>
        </div>
      </div>

      <InvendusScanner matchId={matchId} initialAnnuleCount={count || 0} />
    </div>
  );
}
