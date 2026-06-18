"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUser, getActiveChallenge } from "@/lib/auth";
import { getLeaderboard } from "@/lib/leaderboard";
import { marksEnabled, markEligibility } from "@/lib/marks";

export type MarkResult = { ok: boolean; error?: string };

export async function createMark(targetId: string): Promise<MarkResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Sign in to mark." };

  const challenge = await getActiveChallenge();
  if (!marksEnabled(challenge)) return { ok: false, error: "Marks aren't enabled for this challenge." };

  const supabase = await createClient();
  const board = await getLeaderboard(challenge, user.id);
  const viewer = board.rows.find((r) => r.participant_id === user.id);
  const target = board.rows.find((r) => r.participant_id === targetId);

  const { count } = await supabase
    .from("marks")
    .select("*", { count: "exact", head: true })
    .eq("challenge_id", challenge.id)
    .eq("marker_user_id", user.id)
    .eq("status", "active");

  const elig = markEligibility(viewer, target, count ?? 0, false);
  if (!elig.canMark) return { ok: false, error: elig.reason ?? "You can't mark this reader." };

  const { error } = await supabase.from("marks").insert({
    challenge_id: challenge.id,
    marker_user_id: user.id,
    target_user_id: targetId,
  });
  if (error) {
    // Unique violation: a mark row for this pair already exists (incl. released).
    if (error.code === "23505") return { ok: false, error: "You've already marked this reader this challenge." };
    if (/ranked above/i.test(error.message)) return { ok: false, error: "You can only mark a reader ranked above you." };
    return { ok: false, error: "Couldn't place that mark. Try again." };
  }

  revalidatePath("/leaderboard");
  revalidatePath("/you");
  revalidatePath(`/readers/${targetId}`);
  return { ok: true };
}

export async function releaseMark(markId: string): Promise<MarkResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Sign in." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("marks")
    .update({ status: "released", released_at: new Date().toISOString() })
    .eq("id", markId)
    .eq("marker_user_id", user.id)
    .eq("status", "active");
  if (error) return { ok: false, error: "Couldn't release that mark." };

  revalidatePath("/leaderboard");
  revalidatePath("/you");
  return { ok: true };
}
