"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/auth";

export type ToggleResult = { ok: boolean; error?: string };

export async function setMarksEnabled(challengeId: string, enabled: boolean): Promise<ToggleResult> {
  await requireSuperAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("challenges")
    .update({ marks_enabled: enabled })
    .eq("id", challengeId);
  if (error) {
    // Most likely the 0009 migration hasn't been applied (column absent).
    return { ok: false, error: "Couldn't update. Has migration 0009 been applied?" };
  }

  await supabase.rpc("write_audit", {
    p_action: "challenge.feature_toggle",
    p_entity_type: "challenge",
    p_entity_id: challengeId,
    p_previous: { marks_enabled: !enabled },
    p_new: { feature: "marks", marks_enabled: enabled },
  });

  revalidatePath(`/admin/challenges/${challengeId}`);
  revalidatePath("/leaderboard");
  revalidatePath("/you");
  return { ok: true };
}
