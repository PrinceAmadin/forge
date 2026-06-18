"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSuperAdmin, getUser, getActiveChallenge } from "@/lib/auth";
import type { Role } from "@/lib/types";

export type AdminResult = { ok: boolean; error?: string };

const ROLES: Role[] = ["participant", "admin", "super_admin"];

// Role change. Direct update under the profiles_update_admin RLS policy (works
// without a new migration); audited via the already-live write_audit(). §FIX-4
export async function setUserRole(targetId: string, role: Role): Promise<AdminResult> {
  await requireSuperAdmin();
  if (!ROLES.includes(role)) return { ok: false, error: "Unknown role." };

  const me = await getUser();
  if (me?.id === targetId && role !== "super_admin") {
    return { ok: false, error: "You can't remove your own super admin role." };
  }

  const supabase = await createClient();
  const { data: prev } = await supabase.from("profiles").select("role").eq("id", targetId).single();
  if (!prev) return { ok: false, error: "User not found." };
  if (prev.role === role) return { ok: true };

  const { error } = await supabase.from("profiles").update({ role }).eq("id", targetId);
  if (error) return { ok: false, error: "Couldn't update the role." };

  await supabase.rpc("write_audit", {
    p_action: "user.role_change",
    p_entity_type: "profile",
    p_entity_id: targetId,
    p_previous: { role: prev.role },
    p_new: { role },
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${targetId}`);
  revalidatePath("/leaderboard");
  return { ok: true };
}

// Manual hours entry. Requires migrations 0006 + 0007. §FIX-5
export async function addManualEntry(
  targetId: string,
  day: number,
  hours: number,
  reason: string
): Promise<AdminResult> {
  await requireSuperAdmin();
  if (!reason.trim()) return { ok: false, error: "A reason is required." };
  if (!(hours > 0 && hours <= 24)) return { ok: false, error: "Hours must be between 0.1 and 24." };
  if (!Number.isInteger(day) || day < 1) return { ok: false, error: "Enter a valid day." };

  const challenge = await getActiveChallenge();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_manual_submission", {
    p_challenge_id: challenge.id,
    p_participant_id: targetId,
    p_day: day,
    p_hours: hours,
    p_reason: reason.trim(),
  });
  if (error) return { ok: false, error: error.message.replace(/^.*?:\s*/, "") };

  revalidatePath(`/admin/users/${targetId}`);
  revalidatePath("/leaderboard");
  revalidatePath("/you");
  return { ok: true };
}

export async function removeManualEntry(submissionId: string, targetId: string): Promise<AdminResult> {
  await requireSuperAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_remove_manual", { p_submission_id: submissionId });
  if (error) return { ok: false, error: "Couldn't remove that entry." };

  revalidatePath(`/admin/users/${targetId}`);
  revalidatePath("/leaderboard");
  revalidatePath("/you");
  return { ok: true };
}
