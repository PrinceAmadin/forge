"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser, getProfile } from "@/lib/auth";

export type ProfileResult = { ok?: boolean; message?: string; error?: string };

export interface ProfileInput {
  full_name: string;
  hall_id: string;
  course: string;
  phone_local: string; // local part typed after the +234 prefix; "" = clear
}

function describeError(e: unknown): string {
  if (e && typeof e === "object") {
    const err = e as { message?: unknown; code?: unknown; details?: unknown };
    if (typeof err.message === "string" && err.message.trim()) return err.message;
    if (err.code != null && String(err.code).trim()) {
      const details = typeof err.details === "string" && err.details.trim() ? err.details : "see server logs";
      return `Database error [${String(err.code)}]: ${details}`;
    }
  }
  if (typeof e === "string" && e.trim()) return e;
  return "Couldn't save your profile — check server logs";
}

// Normalize a Nigerian mobile number to E.164 (+234XXXXXXXXXX). Accepts the
// local part with or without a leading 0 / +234 / 234. Returns null for empty
// (phone is optional). §profile-edit
function normalizeNigerianPhone(local: string): { value: string | null; error?: string } {
  let d = local.replace(/\D/g, "");
  if (!d) return { value: null };
  if (d.startsWith("234")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length !== 10 || !/^[789]/.test(d)) {
    return { value: null, error: "Enter a valid Nigerian phone number." };
  }
  return { value: `+234${d}` };
}

export async function updateProfile(input: ProfileInput): Promise<ProfileResult> {
  const user = await getUser();
  if (!user) redirect("/auth");
  const current = await getProfile();
  if (!current) redirect("/welcome");

  // Server-side validation — never trust the client alone.
  const fullName = (input.full_name ?? "").trim();
  const course = (input.course ?? "").trim();
  const hallId = (input.hall_id ?? "").trim();
  if (fullName.length < 2) return { error: "Enter your full name (at least 2 characters)." };
  if (!hallId) return { error: "Select your hall." };
  if (!course) return { error: "Enter your course." };

  const phone = normalizeNigerianPhone(input.phone_local ?? "");
  if (phone.error) return { error: phone.error };

  // TODO(v1.1): When hall_competition_enabled = true on the active challenge,
  // restrict hall changes to the first 24h after enrollment OR require admin
  // approval — otherwise users could switch halls mid-challenge strategically.

  try {
    const supabase = await createClient();

    // Diff against current state; only changed fields are written + audited.
    const fields: { key: string; next: string | null; prev: string | null }[] = [
      { key: "full_name", next: fullName, prev: current.full_name },
      { key: "hall_id", next: hallId, prev: current.hall_id },
      { key: "course", next: course, prev: current.course },
      { key: "phone", next: phone.value, prev: current.phone },
    ];

    const changed: Record<string, string | null> = {};
    const prevChanged: Record<string, string | null> = {};
    for (const f of fields) {
      if (f.next !== f.prev) {
        changed[f.key] = f.next;
        prevChanged[f.key] = f.prev;
      }
    }

    if (Object.keys(changed).length === 0) {
      return { ok: true, message: "No changes to save" };
    }

    // Owner-only update under profiles_update_self; the bootstrap trigger keeps
    // role immutable, so role can't be touched here even if it were sent.
    const { error: updErr } = await supabase.from("profiles").update(changed).eq("id", user.id);
    if (updErr) return { error: describeError(updErr) };

    await supabase.rpc("write_audit", {
      p_action: "profile.update",
      p_entity_type: "profile",
      p_entity_id: user.id,
      p_previous: prevChanged,
      p_new: changed,
    });

    revalidatePath("/settings");
    revalidatePath("/leaderboard");
    revalidatePath("/you");
  } catch (e) {
    return { error: describeError(e) };
  }

  redirect("/settings?updated=1");
}
