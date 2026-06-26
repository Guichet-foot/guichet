import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { CategoryManager } from "./category-manager";
import { ApplyTemplatesButton } from "./apply-templates-button";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function BilletsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRole(["super_admin", "admin_zone"]);
  const supabase = await createClient();

  const { data: match } = await supabase
    .from("matches")
    .select("id, home_team, away_team, zone_id")
    .eq("id", id)
    .single();

  if (!match) notFound();

  const { data: categories } = await supabase
    .from("ticket_categories")
    .select("*")
    .eq("match_id", id)
    .order("display_order");

  const categoryIds = categories?.map((c) => c.id) || [];
  let soldCounts: Record<string, number> = {};

  if (categoryIds.length > 0) {
    const { data: tickets } = await supabase
      .from("tickets")
      .select("category_id")
      .in("category_id", categoryIds)
      .neq("status", "annule");

    if (tickets) {
      soldCounts = tickets.reduce(
        (acc, t) => {
          acc[t.category_id] = (acc[t.category_id] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );
    }
  }

  // Fetch ticket templates for the zone
  const { data: templates } = await supabase
    .from("ticket_templates")
    .select("*")
    .eq("zone_id", match.zone_id)
    .order("price");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/matchs/${id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Retour
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold font-heading">
            Configuration billets
          </h1>
          <p className="text-muted-foreground">
            {match.home_team} vs {match.away_team}
          </p>
        </div>
      </div>

      {/* Apply templates button */}
      {templates && templates.length > 0 && (
        <ApplyTemplatesButton
          matchId={id}
          templates={templates as any[]}
          hasExistingCategories={(categories?.length || 0) > 0}
        />
      )}

      <CategoryManager
        matchId={id}
        categories={categories || []}
        soldCounts={soldCounts}
      />
    </div>
  );
}
