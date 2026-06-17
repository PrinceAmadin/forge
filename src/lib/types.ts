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
}

export interface PrizeTier {
  position?: number;
  positions?: [number, number];
  amount: number;
  label: string;
}

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
