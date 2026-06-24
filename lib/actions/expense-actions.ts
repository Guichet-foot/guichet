"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ExpenseCategory } from "@/lib/types";

export async function createExpense(formData: {
  zoneId: string;
  matchId: string | null;
  label: string;
  category: ExpenseCategory;
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
    zone_id: formData.zoneId,
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
