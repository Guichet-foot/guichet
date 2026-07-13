"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
export async function createExpense(formData: {
  zoneId?: string | null;
  c3AccountId?: string | null;
  matchId: string | null;
  label: string;
  category: string;
  amount: number;
  expenseDate: string;
  notes: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Non authentifié" };

  const { error } = await supabase.from("expenses").insert({
    zone_id: formData.zoneId || null,
    c3_account_id: formData.c3AccountId || null,
    match_id: formData.matchId || null,
    label: formData.label,
    category: formData.category,
    amount: formData.amount,
    expense_date: formData.expenseDate,
    added_by: user.id,
    notes: formData.notes || null,
  });

  if (error) return { error: error.message };

  revalidatePath("/finances");
  return { success: true };
}
