"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveChallenge } from "@/lib/auth";

export type JoinState = { error?: string };

export async function joinChallenge(_prev: JoinState, _formData: FormData): Promise<JoinState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  // A profile is required before enrolment. §9
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) redirect("/welcome");

  const challenge = await getActiveChallenge();

  const { error } = await supabase.from("challenge_participants").insert({
    challenge_id: challenge.id,
    participant_id: user.id,
    rules_accepted_at: new Date().toISOString(),
  });

  // Unique violation = already enrolled; treat as success.
  if (error && error.code !== "23505") {
    return { error: "Couldn't enrol you. Try again." };
  }

  await supabase.from("events").insert({ user_id: user.id, name: "challenge.join" });
  redirect("/leaderboard");
}
