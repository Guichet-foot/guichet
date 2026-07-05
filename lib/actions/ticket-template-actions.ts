"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createTicketTemplate(formData: {
  zoneId?: string | null;
  c3AccountId?: string | null;
  name: string;
  price: number;
  defaultQuantity: number;
  color: string;
  description?: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("ticket_templates").insert({
    zone_id: formData.zoneId || null,
    c3_account_id: formData.c3AccountId || null,
    name: formData.name,
    price: formData.price,
    default_quantity: formData.defaultQuantity,
    color: formData.color,
    description: formData.description || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/billets");
  return { success: true };
}

export async function updateTicketTemplate(
  id: string,
  formData: {
    name: string;
    price: number;
    defaultQuantity: number;
    color: string;
    description?: string;
  }
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ticket_templates")
    .update({
      name: formData.name,
      price: formData.price,
      default_quantity: formData.defaultQuantity,
      color: formData.color,
      description: formData.description || null,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/billets");
  return { success: true };
}

export async function deleteTicketTemplate(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("ticket_templates").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/billets");
  return { success: true };
}

export async function applyTemplatesToMatch(matchId: string, templateIds: string[]) {
  const supabase = await createClient();

  const { data: templates } = await supabase
    .from("ticket_templates")
    .select("name, price, default_quantity")
    .in("id", templateIds);

  if (!templates || templates.length === 0) return { error: "Aucun modèle sélectionné" };

  const categories = templates.map((t, i) => ({
    match_id: matchId,
    name: t.name,
    price: t.price,
    quantity_total: t.default_quantity,
    display_order: i,
    active: true,
  }));

  const { error } = await supabase.from("ticket_categories").insert(categories);
  if (error) return { error: error.message };

  revalidatePath(`/matchs/${matchId}`);
  revalidatePath(`/matchs/${matchId}/billets`);
  return { success: true, count: categories.length };
}
