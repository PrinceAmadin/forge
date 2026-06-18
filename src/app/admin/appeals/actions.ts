"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

export type ResolveResult = { ok: boolean; error?: string };

// Uphold (rejection stands) or restore (submission flips back to confirmed).
// On restore we deliberately do NOT touch reviewed_at/reviewed_by — the
// rejection history is preserved; only the appeal record changes. §FIX-6
export async function resolveAppeal(
  appealId: string,
  decision: "upheld" | "restored"
): Promise<ResolveResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: appeal } = await supabase
    .from("appeals")
    .select("id, status, submission_id")
    .eq("id", appealId)
    .maybeSingle();
  if (!appeal) return { ok: false, error: "Appeal not found." };
  if (appeal.status !== "pending") return { ok: false, error: "This appeal is already resolved." };

  const { error: aErr } = await supabase
    .from("appeals")
    .update({ status: decision, resolved_at: new Date().toISOString() })
    .eq("id", appealId);
  if (aErr) return { ok: false, error: "Couldn't update the appeal." };

  if (decision === "restored") {
    const { data: sub } = await supabase
      .from("submissions")
      .select("hours_claimed")
      .eq("id", appeal.submission_id)
      .single();
    const { error: sErr } = await supabase
      .from("submissions")
      .update({ status: "confirmed", hours_credited: sub?.hours_claimed ?? null })
      .eq("id", appeal.submission_id);
    if (sErr) return { ok: false, error: "Couldn't restore the submission." };
  }

  await supabase.rpc("write_audit", {
    p_action: `appeal.${decision}`,
    p_entity_type: "appeal",
    p_entity_id: appealId,
    p_previous: { status: "pending" },
    p_new: { status: decision },
  });

  revalidatePath("/admin/appeals");
  revalidatePath("/leaderboard");
  revalidatePath("/you");
  return { ok: true };
}
