"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getChallengeBySlug } from "@/lib/challenges";
import { isJoinable } from "@/lib/challenge";

export type JoinState = { error?: string };

export async function joinChallenge(_prev: JoinState, formData: FormData): Promise<JoinState> {
  // The slug comes from the form, but everything about it is re-checked here:
  // the challenge must exist and be joinable. A crafted slug can only ever
  // enrol the caller, never someone else, since participant_id is the session.
  const slug = String(formData.get("slug") ?? "").trim();
  if (!slug) return { error: "Couldn't tell which challenge you meant." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth?next=${encodeURIComponent(`/c/${slug}`)}`);

  // A profile is required before enrolment. §9
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) redirect(`/welcome?next=${encodeURIComponent(`/c/${slug}`)}`);

  const challenge = await getChallengeBySlug(slug);
  if (!challenge) return { error: "That challenge doesn't exist." };
  if (!isJoinable(challenge)) return { error: "This challenge isn't open for entries." };

  const { error } = await supabase.from("challenge_participants").insert({
    challenge_id: challenge.id,
    participant_id: user.id,
    rules_accepted_at: new Date().toISOString(),
  });

  // Unique violation = already enrolled; treat as success.
  if (error && error.code !== "23505") {
    return { error: "Couldn't enrol you. Try again." };
  }

  // The payload now records WHICH challenge, which the old single-challenge
  // version had no need to.
  await supabase.from("events").insert({
    user_id: user.id,
    name: "challenge.join",
    payload: { challenge_id: challenge.id, slug: challenge.slug },
  });

  redirect(`/c/${challenge.slug}/leaderboard`);
}
