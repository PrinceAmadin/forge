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

// Coerce any thrown/returned error shape into a useful string. Supabase/Postgres
// errors are plain objects ({ message, code, details, hint }) that JSON.stringify
// to "{}" in a React child — hence the silent empty-error bug. §admin-delete
function describeError(e: unknown): string {
  if (e && typeof e === "object") {
    const err = e as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown };
    if (typeof err.message === "string" && err.message.trim()) return err.message;
    if (err.code != null && String(err.code).trim()) {
      const details =
        typeof err.details === "string" && err.details.trim()
          ? err.details
          : typeof err.hint === "string" && err.hint.trim()
            ? err.hint
            : "see server logs";
      return `Database error [${String(err.code)}]: ${details}`;
    }
  }
  if (typeof e === "string" && e.trim()) return e;
  return "Deletion failed — check server logs";
}

// Permanent account deletion (super_admin only). Deletes the auth.users row via
// the service-role client, which cascades to profiles and downstream per the
// 0011/0012 FK rules. Audited with the deleted user's identity denormalized so
// the record survives the row going away. §admin-delete
//
// requireSuperAdmin() (may redirect) and the success redirect() both throw
// control-flow signals, so they stay OUTSIDE the try/catch. Everything that can
// fail with a real error returns a string via describeError — never throws.
export async function deleteUser(targetId: string): Promise<AdminResult> {
  const me = await requireSuperAdmin();
  if (targetId === me.id) {
    return { ok: false, error: "You can't delete your own account." };
  }

  try {
    const supabase = await createClient();
    const { data: target, error: tErr } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", targetId)
      .single();
    if (tErr) return { ok: false, error: describeError(tErr) };
    if (!target) return { ok: false, error: "User not found." };

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { ok: false, error: "Deletion failed — SUPABASE_SERVICE_ROLE_KEY is not set on the server." };
    }

    const admin = createAdminClient();
    const { data: authUser } = await admin.auth.admin.getUserById(targetId);
    const email = authUser?.user?.email ?? null;

    const { error: delErr } = await admin.auth.admin.deleteUser(targetId);
    if (delErr) return { ok: false, error: describeError(delErr) };

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
  } catch (e) {
    return { ok: false, error: describeError(e) };
  }

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
