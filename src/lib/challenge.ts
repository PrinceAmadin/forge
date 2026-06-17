import type { Challenge } from "@/lib/types";

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
