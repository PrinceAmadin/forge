"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
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

// Permanent account deletion (super_admin only). Deletes the auth.users row via
// the service-role client, which cascades to profiles and downstream per the
// 0011 FK rules. Audited with the deleted user's identity denormalized so the
// record survives the row going away. §admin-delete
export async function deleteUser(targetId: string): Promise<AdminResult> {
  const me = await requireSuperAdmin();
  if (targetId === me.id) {
    return { ok: false, error: "You can't delete your own account." };
  }

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", targetId)
    .single();
  if (!target) return { ok: false, error: "User not found." };

  let email: string | null = null;
  try {
    const admin = createAdminClient();
    const { data: authUser } = await admin.auth.admin.getUserById(targetId);
    email = authUser?.user?.email ?? null;
    const { error: delErr } = await admin.auth.admin.deleteUser(targetId);
    if (delErr) return { ok: false, error: delErr.message };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Deletion failed." };
  }

  // Denormalize the deleted user into the audit record (no profile row remains).
  await supabase.rpc("write_audit", {
    p_action: "user.delete",
    p_entity_type: "profile",
    p_entity_id: targetId,
    p_previous: { full_name: target.full_name, email, role: target.role },
    p_new: null,
  });

  revalidatePath("/admin/users");
  revalidatePath("/leaderboard");
  // redirect() must stay outside the try above — it signals via a thrown
  // NEXT_REDIRECT that the catch would otherwise swallow.
  redirect("/admin/users?deleted=1");
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
