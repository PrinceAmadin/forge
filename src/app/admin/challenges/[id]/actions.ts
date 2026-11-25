"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/auth";
import { describeError } from "@/lib/errors";
import type { ChallengeStatus } from "@/lib/types";

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
  // Marks appear on every challenge-scoped board, so invalidate the dynamic
  // route rather than the pre-routing paths, which are only redirect stubs now.
  revalidatePath("/c/[slug]/leaderboard", "page");
  revalidatePath("/c/[slug]/you", "page");
  return { ok: true };
}

// Status is the one field that changes what participants can do, so it goes
// through admin_set_challenge_status rather than a table update: the RPC owns
// the transition graph, the launch-readiness check and the audit row, all in
// one transaction. A direct update would enforce none of that.
export async function setChallengeStatus(
  challengeId: string,
  next: ChallengeStatus
): Promise<ToggleResult> {
  await requireSuperAdmin();
  const supabase = await createClient();

  const { error } = await supabase.rpc("admin_set_challenge_status", {
    p_challenge_id: challengeId,
    p_next: next,
  });

  if (error) {
    // 42883 = undefined_function: the migration that adds the RPC is missing.
    if (error.code === "42883") {
      return {
        ok: false,
        error:
          "The database is missing the status-transition function. Apply " +
          "supabase/migrations/0015_challenge_status.sql, then try again.",
      };
    }
    // Everything else is a raise from inside the function — an illegal
    // transition or a launch-readiness failure — and its message is written to
    // be read by a person, so pass it through rather than flattening it.
    return { ok: false, error: describeError(error, "Couldn't change the status.") };
  }

  revalidatePath(`/admin/challenges/${challengeId}`);
  revalidatePath("/admin/challenges");
  revalidatePath("/challenges");
  revalidatePath("/c/[slug]", "page");
  revalidatePath("/c/[slug]/leaderboard", "page");
  return { ok: true };
}
