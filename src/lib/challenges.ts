import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile, getUser } from "@/lib/auth";
import { isBoardPublic, prizePool } from "@/lib/challenge";
import type { Challenge, ChallengeStatus, Profile } from "@/lib/types";

// Data access for challenges, replacing the zero-argument getActiveChallenge()
// chokepoint. Pure logic (lifecycle predicates, prize maths, text parsing) lives
// in lib/challenge.ts so it stays testable without a database client.
//
// Every function here is challenge-scoped by slug. Nothing in this module reads
// a hardcoded slug.

const CHALLENGE_COLUMNS = "*";

// Statuses a participant may browse. Drafts are deliberately excluded.
export const PUBLIC_STATUSES: ChallengeStatus[] = ["active", "verification", "completed"];

// cache() keys on the argument, so this is memoized per (slug, request) rather
// than globally — two different slugs in one render cost two queries, the same
// slug twice costs one. Deliberately does NOT filter on status: callers decide
// what they will accept, and a super_admin previewing a draft needs to read it.
export const getChallengeBySlug = cache(async (slug: string): Promise<Challenge | null> => {
  if (!slug) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("challenges")
    .select(CHALLENGE_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  return (data as Challenge | null) ?? null;
});

// 404s a missing challenge, and 404s a draft for everyone except a super_admin
// (who needs to preview it before launch). Use this in any route segment that
// takes a [slug].
export async function requireChallengeBySlug(slug: string): Promise<Challenge> {
  const challenge = await getChallengeBySlug(slug);
  if (!challenge) notFound();
  if (challenge.status === "draft") {
    const profile = await getProfile();
    if (profile?.role !== "super_admin") notFound();
  }
  return challenge;
}

export interface ChallengeListItem {
  challenge: Challenge;
  participantCount: number;
  prizePool: number;
  viewerEnrolled: boolean;
}

export interface ChallengeFilter {
  statuses?: ChallengeStatus[];
  /** "any" includes unlisted challenges — admin surfaces only. */
  visibility?: "listed" | "unlisted" | "any";
  viewerId?: string | null;
}

// Powers the public browse page and the challenge switcher.
//
// Implemented as three bounded queries rather than a per-row count loop. Phase
// 1.2 replaces the body with a single get_challenge_index() RPC — the signature
// and return shape are already the RPC's, so callers will not change.
export async function listChallenges(
  filter: ChallengeFilter = {}
): Promise<ChallengeListItem[]> {
  const statuses = filter.statuses ?? PUBLIC_STATUSES;
  const visibility = filter.visibility ?? "listed";
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("challenges")
    .select(CHALLENGE_COLUMNS)
    .in("status", statuses)
    .order("start_date", { ascending: false });

  let challenges = (rows ?? []) as Challenge[];
  if (visibility !== "any") {
    // `visibility` is absent until migration 0015; those rows count as listed.
    challenges = challenges.filter((c) => (c.visibility ?? "listed") === visibility);
  }
  if (challenges.length === 0) return [];

  const ids = challenges.map((c) => c.id);

  // One round trip for the counts; tallied in JS because PostgREST cannot group.
  // Bounded by participants-across-listed-challenges, which the RPC in 1.2
  // removes entirely.
  const { data: enrolments } = await supabase
    .from("challenge_participants")
    .select("challenge_id, participant_id")
    .in("challenge_id", ids);

  const counts = new Map<string, number>();
  const viewerIn = new Set<string>();
  for (const e of enrolments ?? []) {
    counts.set(e.challenge_id, (counts.get(e.challenge_id) ?? 0) + 1);
    if (filter.viewerId && e.participant_id === filter.viewerId) viewerIn.add(e.challenge_id);
  }

  return challenges.map((challenge) => ({
    challenge,
    participantCount: counts.get(challenge.id) ?? 0,
    prizePool: prizePool(challenge),
    viewerEnrolled: viewerIn.has(challenge.id),
  }));
}

export interface Enrolment {
  challenge: Challenge;
  joinedAt: string;
  isDisqualified: boolean;
  termsVersionAccepted: number | null;
}

// Every challenge this user has joined, newest first. A user may be in several
// at once, which is what the challenge switcher reads.
export const getMyEnrolments = cache(async (userId: string): Promise<Enrolment[]> => {
  if (!userId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("challenge_participants")
    .select("joined_at, is_disqualified, challenges(*)")
    .eq("participant_id", userId)
    .order("joined_at", { ascending: false });

  type Row = {
    joined_at: string;
    is_disqualified: boolean;
    terms_version_accepted?: number | null;
    challenges: Challenge | null;
  };

  return ((data ?? []) as unknown as Row[])
    .filter((r): r is Row & { challenges: Challenge } => r.challenges != null)
    .map((r) => ({
      challenge: r.challenges,
      joinedAt: r.joined_at,
      isDisqualified: r.is_disqualified,
      // Column arrives with migration 0015; null until then.
      termsVersionAccepted: r.terms_version_accepted ?? null,
    }));
});

// Which challenge a bare /leaderboard, /submit or /you should land on.
//
// Order of preference:
//   1. `preferredSlug` (the forge_c cookie) when it is still a live enrolment —
//      so a bare URL returns you to where you last were.
//   2. the most recently joined ACTIVE challenge
//   3. the most recently joined challenge in VERIFICATION
//   4. the latest-ending COMPLETED challenge
//   5. null → the caller should send them to /challenges
//
// Archived enrolments never win: they are frozen, so landing there looks broken.
export async function resolvePrimaryChallenge(
  userId: string,
  preferredSlug?: string | null
): Promise<Challenge | null> {
  const enrolments = await getMyEnrolments(userId);
  const live = enrolments.filter((e) => e.challenge.status !== "archived");
  if (live.length === 0) return null;

  if (preferredSlug) {
    const preferred = live.find((e) => e.challenge.slug === preferredSlug);
    if (preferred) return preferred.challenge;
  }

  // getMyEnrolments is already ordered by joined_at desc, so `find` gives the
  // most recently joined match for the first two tiers.
  const byStatus = (status: ChallengeStatus) =>
    live.find((e) => e.challenge.status === status)?.challenge ?? null;

  const active = byStatus("active");
  if (active) return active;

  const verification = byStatus("verification");
  if (verification) return verification;

  const completed = live
    .filter((e) => e.challenge.status === "completed")
    .sort((a, b) => b.challenge.end_date.localeCompare(a.challenge.end_date))[0];
  return completed?.challenge ?? null;
}

export interface EnrolledViewer {
  profile: Profile;
  challenge: Challenge;
  enrolment: Enrolment;
}

// The full gate for a participant-only, challenge-scoped route. Replaces
// requireOnboardedViewer(), which could only ever resolve one challenge and
// always bounced to the hardcoded /exam-flame.
//
// Redirects preserve the deep link so the funnel
// /c/slug → /auth → /welcome → /c/slug still works.
export async function requireEnrolled(slug: string): Promise<EnrolledViewer> {
  const challenge = await requireChallengeBySlug(slug);
  const dest = `/c/${challenge.slug}`;

  const user = await getUser();
  if (!user) redirect(`/auth?next=${encodeURIComponent(dest)}`);

  const profile = await getProfile();
  if (!profile) redirect(`/welcome?next=${encodeURIComponent(dest)}`);

  const enrolment = (await getMyEnrolments(user.id)).find(
    (e) => e.challenge.id === challenge.id
  );
  // Not enrolled → the challenge's own landing page, which offers the join.
  if (!enrolment) redirect(dest);

  return { profile, challenge, enrolment };
}

// Whether this viewer may read the board at all: public once under way, and
// always visible to a super_admin previewing a draft.
export async function canViewBoard(challenge: Challenge): Promise<boolean> {
  if (isBoardPublic(challenge)) return true;
  const profile = await getProfile();
  return profile?.role === "super_admin";
}
