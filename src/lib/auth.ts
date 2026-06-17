import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_CHALLENGE_SLUG } from "@/lib/env";
import type { Profile, Challenge } from "@/lib/types";

// Deduped per-request: the session user.
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

// Deduped per-request: the viewer's profile (or null if not yet created).
export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  return (data as Profile | null) ?? null;
});

export const getActiveChallenge = cache(async (): Promise<Challenge> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("challenges")
    .select("*")
    .eq("slug", ACTIVE_CHALLENGE_SLUG)
    .single();
  if (error || !data) throw new Error("Active challenge not found — run the seed.");
  return data as Challenge;
});

// Gate a page on a completed profile + challenge enrolment, routing exactly
// per §9 steps 6–8. Returns the profile when fully onboarded.
export async function requireOnboardedViewer(): Promise<Profile> {
  const user = await getUser();
  if (!user) redirect("/auth");

  const profile = await getProfile();
  if (!profile) redirect("/welcome");

  const challenge = await getActiveChallenge();
  const supabase = await createClient();
  const { data: enrolment } = await supabase
    .from("challenge_participants")
    .select("id")
    .eq("challenge_id", challenge.id)
    .eq("participant_id", user.id)
    .maybeSingle();

  if (!enrolment) redirect("/exam-flame");
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/auth");
  if (profile.role !== "admin" && profile.role !== "super_admin") redirect("/leaderboard");
  return profile;
}
