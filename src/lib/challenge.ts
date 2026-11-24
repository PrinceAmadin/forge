import type { Challenge, PrizeTier, RewardKind } from "@/lib/types";

// All day math is anchored to the challenge timezone (Africa/Lagos), computed
// server-side. The client never supplies challenge_day. §10

// YYYY-MM-DD for "now" in the given IANA timezone.
export function dateInTz(tz: string, now: Date = new Date()): string {
  // en-CA yields ISO-like YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

// Current 1-based challenge day. 0 means the challenge hasn't started;
// a value > duration means it has ended.
export function currentChallengeDay(challenge: Challenge, now: Date = new Date()): number {
  const today = dateInTz(challenge.timezone, now);
  const diff = daysBetween(challenge.start_date, today);
  return diff < 0 ? 0 : diff + 1;
}

// The day a new submission targets: today's challenge day, clamped to range.
export function submittableDay(challenge: Challenge, now: Date = new Date()): number | null {
  const day = currentChallengeDay(challenge, now);
  if (day < 1 || day > challenge.duration_days) return null;
  return day;
}

// A submission for `day` is accepted on day D and the following day (Day N
// 00:00 → Day N+1 23:59). §10
export function dayIsOpen(challenge: Challenge, day: number, now: Date = new Date()): boolean {
  const current = currentChallengeDay(challenge, now);
  return day === current || day === current - 1;
}

// "Monday, 30 June 2026 · Africa/Lagos" for the submit header. §6.3
export function formatLagosDate(challenge: Challenge, now: Date = new Date()): string {
  const label = new Intl.DateTimeFormat("en-GB", {
    timeZone: challenge.timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);
  return `${label} · ${challenge.timezone}`;
}

// "Starts 17 June 2026 · Ends 6 July 2026" for the challenge hero. §6.5
export function formatDateRange(challenge: Challenge): string {
  const fmt = (d: string) =>
    new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(
      new Date(`${d}T00:00:00`)
    );
  return `Starts ${fmt(challenge.start_date)} · Ends ${fmt(challenge.end_date)}`;
}

// ---------------------------------------------------------------------------
// Lifecycle semantics. Spec §10 defines the state machine
// draft → active → verification → completed → archived; these predicates are
// the single place those rules are expressed, so SQL guards, route guards and
// UI copy cannot drift apart.
// ---------------------------------------------------------------------------

// Submissions are accepted only while the challenge is active. §10
export function acceptsSubmissions(challenge: Challenge): boolean {
  return challenge.status === "active";
}

// Joining is open while the challenge is active. A draft is visible to a
// super_admin for preview, but is never joinable.
export function isJoinable(challenge: Challenge): boolean {
  return challenge.status === "active";
}

// The board is public once a challenge is under way and stays readable after
// it ends — results are the point. §10
export function isBoardPublic(challenge: Challenge): boolean {
  return (
    challenge.status === "active" ||
    challenge.status === "verification" ||
    challenge.status === "completed"
  );
}

// After archiving, everything is frozen. §10
export function isReadOnly(challenge: Challenge): boolean {
  return challenge.status === "archived";
}

// ---------------------------------------------------------------------------
// Rewards. Not every challenge pays money: a friendly one has no reward at
// all, and a custom one describes it in words.
// ---------------------------------------------------------------------------

// Rows created before the reward columns existed are all cash challenges.
export function rewardKind(challenge: Challenge): RewardKind {
  return challenge.reward_kind ?? "cash";
}

export function paysCash(challenge: Challenge): boolean {
  return rewardKind(challenge) === "cash";
}

// How many winners a tier covers: one position, or an inclusive range.
export function tierSeats(tier: PrizeTier): number {
  return tier.positions ? tier.positions[1] - tier.positions[0] + 1 : 1;
}

// Total money on the line. Replaces three separate copies of this reduce.
// A tier with no amount contributes nothing, so a friendly or custom challenge
// totals 0 and callers can treat 0 as "don't show money".
export function prizePool(challenge: Challenge): number {
  if (!paysCash(challenge)) return 0;
  return (challenge.prize_structure ?? []).reduce(
    (sum, tier) => sum + (tier.amount ?? 0) * tierSeats(tier),
    0
  );
}

// The honours line — the rank that matters, whether or not money sits behind
// it. Null means the challenge draws no cut at all.
export function prizeLine(challenge: Challenge): number | null {
  const line = challenge.prize_line_position;
  return typeof line === "number" && line >= 1 ? line : null;
}

// ---------------------------------------------------------------------------
// Text blocks stored as newline-delimited strings.
// ---------------------------------------------------------------------------

// Rules render as a numbered list, so a stored leading "1. " is stripped to
// avoid "1. 1. Submit one entry per day".
export function parseRules(rules: string | null | undefined): string[] {
  return (rules ?? "")
    .split("\n")
    .map((r) => r.replace(/^\d+\.\s*/, "").trim())
    .filter(Boolean);
}

// Acceptance acknowledgements, one checkbox each. Distinct from `rules`: these
// are the contract the participant ticks, not the public rules blurb.
export function parseTerms(terms: string | null | undefined): string[] {
  return (terms ?? "")
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);
}
