import { cache } from "react";
import { getProfile, getActiveChallenge } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface AdminPendingCounts {
  pendingSubmissions: number;
  pendingAppeals: number;
  total: number;
}

// Ambient admin workload counter, read from server components only (the cog
// badge, the settings rows). Returns null for non-admins so callers can render
// nothing without knowing the role. Scoped to the single active challenge — the
// same set the review queue shows — so the dot and the queue always agree.
//
// cache() dedupes the two count queries across every consumer in one render
// (e.g. the SettingsCog badge and the inline /settings counts).
export const getAdminPendingCounts = cache(
  async (): Promise<AdminPendingCounts | null> => {
    const profile = await getProfile();
    if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
      return null;
    }

    try {
      const challenge = await getActiveChallenge();
      const supabase = await createClient();

      // Two parallel head-only count queries — no rows transferred, no N+1.
      const [subs, appeals] = await Promise.all([
        supabase
          .from("submissions")
          .select("id", { count: "exact", head: true })
          .eq("challenge_id", challenge.id)
          .eq("status", "pending"),
        // appeals has no challenge_id; filter through the submission it targets.
        supabase
          .from("appeals")
          .select("id, submissions!appeals_submission_id_fkey!inner(challenge_id)", {
            count: "exact",
            head: true,
          })
          .eq("status", "pending")
          .eq("submissions.challenge_id", challenge.id),
      ]);

      const pendingSubmissions = subs.count ?? 0;
      const pendingAppeals = appeals.count ?? 0;
      return {
        pendingSubmissions,
        pendingAppeals,
        total: pendingSubmissions + pendingAppeals,
      };
    } catch {
      // Never let an ambient badge break a page (e.g. no active challenge).
      return null;
    }
  }
);
