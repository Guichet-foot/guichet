import { requireRole } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { CategoryManager } from "./category-manager";
import { ApplyTemplatesButton } from "./apply-templates-button";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function BilletsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ zone?: string }>;
}) {
  const { id } = await params;
  const { zone } = await searchParams;
  const profile = await requireRole(["super_admin", "admin_zone", "c3", "fondateur"]);

  const adminClient = await createAdminClient();
  const supabase = await createClient();

  const { data: match } = await adminClient
    .from("matches")
    .select("id, home_team, away_team, zone_id, c3_account_id")
    .eq("id", id)
    .single();

  if (!match) notFound();

  const { data: categories } = await adminClient
    .from("ticket_categories")
    .select("*")
    .eq("match_id", id)
    .order("display_order");

  const categoryIds = categories?.map((c) => c.id) || [];
  let soldCounts: Record<string, number> = {};

  if (categoryIds.length > 0) {
    const { data: tickets } = await adminClient
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

  // Fetch ticket templates: by zone_id for zone accounts, by c3_account_id for C3
  let templates: any[] = [];
  if (match.zone_id) {
    const { data } = await supabase
      .from("ticket_templates")
      .select("*")
      .eq("zone_id", match.zone_id)
      .order("price");
    templates = data || [];
  } else if (match.c3_account_id) {
    const { data } = await adminClient
      .from("ticket_templates")
      .select("*")
      .eq("c3_account_id", match.c3_account_id)
      .order("price");
    templates = data || [];
  }

  const backUrl = zone ? `/matchs/${id}?zone=${zone}` : `/matchs/${id}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={backUrl}>
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

      {templates.length > 0 && (
        <ApplyTemplatesButton
          matchId={id}
          templates={templates}
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
