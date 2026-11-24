export type Role = "participant" | "admin" | "super_admin";
export type SubmissionStatus = "pending" | "confirmed" | "rejected";
export type ChallengeStatus =
  | "draft"
  | "active"
  | "verification"
  | "completed"
  | "archived";

export interface Profile {
  id: string;
  full_name: string;
  hall_id: string | null;
  course: string;
  academic_level: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: Role;
  is_suspended: boolean;
}

export interface Challenge {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  rules: string | null;
  start_date: string;
  end_date: string;
  duration_days: number;
  prize_structure: PrizeTier[];
  prize_line_position: number;
  status: ChallengeStatus;
  timezone: string;
  daily_hour_ceiling: number;
  submission_window_hrs: number;
  // Optional: absent (undefined) until migration 0009 is applied → treated as off.
  marks_enabled?: boolean;

  // --- Platform columns, added by migration 0015. Optional so this type is
  // --- accurate both before and after that migration is applied. Read them
  // --- through the helpers in lib/challenge.ts, which supply the defaults.
  reward_kind?: RewardKind; // absent → treat as "cash" (every existing row)
  prize_note?: string | null; // free-text reward for a non-cash challenge
  visibility?: ChallengeVisibility; // absent → treat as "listed"
  created_by?: string | null;
  terms?: string | null; // acceptance acknowledgements, newline-delimited
  terms_version?: number;
}

export type MarkStatus = "active" | "fulfilled" | "released";

export interface Mark {
  id: string;
  challenge_id: string;
  marker_user_id: string;
  target_user_id: string;
  status: MarkStatus;
  created_at: string;
  fulfilled_at: string | null;
  released_at: string | null;
}

// A tier covers either ONE position or an inclusive RANGE — never both and
// never neither. The `?: never` members make that exclusive while still
// allowing `tier.positions` to be read off the union for narrowing, so the
// existing `tier.positions ? … : …` checks keep working.
//
// `amount` is optional because not every challenge pays money: a friendly
// challenge has no amounts at all, and a non-cash one describes its reward in
// `note` instead. Read totals through prizePool() in lib/challenge.ts rather
// than touching `amount` directly.
export type PrizeTier = {
  amount?: number;
  label: string;
  note?: string;
} & (
  | { position: number; positions?: never }
  | { position?: never; positions: [number, number] }
);

// What a challenge gives the winners. Drives whether the UI shows money at all.
export type RewardKind =
  | "cash" // tiers carry `amount` in naira
  | "none" // friendly challenge — no reward, no cut framing
  | "custom"; // trophy, certificate, bragging rights — see `note` / `prize_note`

export type ChallengeVisibility = "listed" | "unlisted";

export interface LeaderboardRow {
  rank: number;
  participant_id: string;
  full_name: string;
  course: string;
  hall_name: string | null;
  verified_days: number;
  total_hours: number;
  earliest_submission: string | null;
  last_submission: string | null;
  is_disqualified: boolean;
}

// A leaderboard row with movement + viewer context attached server-side.
export interface RankedRow extends LeaderboardRow {
  delta: number | null; // positions gained (+) / lost (−) since last snapshot; null = steady; NaN sentinel handled separately
  isNew: boolean;
  isYou: boolean;
  crossedIntoPrize: boolean; // amber delta — just entered prize zone
  ejectedFromPrize: boolean; // amber delta — just fell out of prize zone
}

export interface Submission {
  id: string;
  challenge_id: string;
  participant_id: string;
  challenge_day: number;
  hours_claimed: number;
  hours_credited: number | null;
  topic: string;
  screenshot_path: string;
  ocr_extracted_hours: number | null;
  whatsapp_post_time: string | null;
  status: SubmissionStatus;
  submitted_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
  internal_notes: string | null;
  flag_reasons: string[];
}
