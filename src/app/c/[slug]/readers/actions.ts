"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { getChallengeBySlug } from "@/lib/challenges";
import { getLeaderboard } from "@/lib/leaderboard";
import { marksEnabled, markEligibility } from "@/lib/marks";

export type MarkResult = { ok: boolean; error?: string };

export async function createMark(slug: string, targetId: string): Promise<MarkResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Sign in to mark." };

  const challenge = await getChallengeBySlug(slug);
  if (!challenge) return { ok: false, error: "That challenge doesn't exist." };
  if (!marksEnabled(challenge)) return { ok: false, error: "Marks aren't enabled for this challenge." };

  const supabase = await createClient();
  const board = await getLeaderboard(challenge, user.id);
  const viewer = board.rows.find((r) => r.participant_id === user.id);
  const target = board.rows.find((r) => r.participant_id === targetId);

  const [{ count }, { data: existing }] = await Promise.all([
    supabase
      .from("marks")
      .select("*", { count: "exact", head: true })
      .eq("challenge_id", challenge.id)
      .eq("marker_user_id", user.id)
      .eq("status", "active"),
    supabase
      .from("marks")
      .select("id")
      .eq("challenge_id", challenge.id)
      .eq("marker_user_id", user.id)
      .eq("target_user_id", targetId)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  // Was hardcoded false, leaving the unique violation below to catch a repeat
  // mark. After 0016 scoped uniqueness to ACTIVE marks there is no violation to
  // catch, because re-marking someone you released is now legal — so this has
  // to be checked properly.
  const elig = markEligibility(viewer, target, count ?? 0, Boolean(existing));
  if (!elig.canMark) return { ok: false, error: elig.reason ?? "You can't mark this reader." };

  const { error } = await supabase.from("marks").insert({
    challenge_id: challenge.id,
    marker_user_id: user.id,
    target_user_id: targetId,
  });
  if (error) {
    // Unique violation now means only one thing: an ACTIVE mark for this pair.
    if (error.code === "23505") return { ok: false, error: "You're already marking this reader." };
    if (/ranked above/i.test(error.message)) return { ok: false, error: "You can only mark a reader ranked above you." };
    return { ok: false, error: "Couldn't place that mark. Try again." };
  }

  revalidatePath(`/c/${challenge.slug}/leaderboard`);
  revalidatePath(`/c/${challenge.slug}/you`);
  revalidatePath(`/c/${challenge.slug}/readers/${targetId}`);
  return { ok: true };
}

export async function releaseMark(slug: string, markId: string): Promise<MarkResult> {
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

  revalidatePath(`/c/${slug}/leaderboard`);
  revalidatePath(`/c/${slug}/you`);
  return { ok: true };
}
