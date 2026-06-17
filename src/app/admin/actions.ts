"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

export type ActionResult = { ok: boolean; error?: string };

// Confirm or reject. The SQL function writes the audit row in the same
// transaction and credits hours on confirm. §16
export async function reviewSubmission(
  submissionId: string,
  decision: "confirmed" | "rejected",
  rejectionReason?: string
): Promise<ActionResult> {
  await requireAdmin();
  if (decision === "rejected" && !rejectionReason?.trim()) {
    return { ok: false, error: "A rejection needs a reason." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_review_submission", {
    p_submission_id: submissionId,
    p_decision: decision,
    p_rejection_reason: rejectionReason?.trim() ?? null,
  });
  if (error) return { ok: false, error: "That didn't go through. Try again." };

  revalidatePath("/leaderboard");
  revalidatePath("/you");
  revalidatePath("/admin");
  return { ok: true };
}

export async function updateNotes(submissionId: string, notes: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("submissions")
    .update({ internal_notes: notes })
    .eq("id", submissionId);
  if (error) return { ok: false, error: "Couldn't save the note." };
  return { ok: true };
}

export async function disqualifyParticipant(
  challengeId: string,
  participantId: string,
  reason: string
): Promise<ActionResult> {
  await requireAdmin();
  if (!reason.trim()) return { ok: false, error: "Disqualification needs a reason." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_disqualify", {
    p_challenge_id: challengeId,
    p_participant_id: participantId,
    p_reason: reason.trim(),
  });
  if (error) return { ok: false, error: "That didn't go through. Try again." };

  revalidatePath("/leaderboard");
  revalidatePath("/admin");
  return { ok: true };
}
