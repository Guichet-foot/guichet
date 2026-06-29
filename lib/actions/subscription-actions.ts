"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateSubscription(zoneId: string, formData: {
  type: string;
  startDate: string;
  endDate: string;
  active: boolean;
}) {
  const supabase = await createAdminClient();

  const { error } = await supabase
    .from("zones")
    .update({
      subscription_type: formData.type || null,
      subscription_start: formData.startDate || null,
      subscription_end: formData.endDate || null,
      subscription_active: formData.active,
    })
    .eq("id", zoneId);

  if (error) return { error: error.message };

  revalidatePath("/fondateur/abonnements");
  return { success: true };
}

export async function toggleSubscriptionActive(zoneId: string, active: boolean) {
  const supabase = await createAdminClient();

  const { error } = await supabase
    .from("zones")
    .update({ subscription_active: active })
    .eq("id", zoneId);

  if (error) return { error: error.message };

  revalidatePath("/fondateur/abonnements");
  return { success: true };
}
