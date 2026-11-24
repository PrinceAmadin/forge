"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getActiveChallenge } from "@/lib/auth";
import { submittableDay, dayIsOpen } from "@/lib/challenge";
import { SUBMISSIONS_BUCKET, submissionStoragePath } from "@/lib/storage";

export interface UploadTarget {
  path: string;
  token: string;
  day: number;
}

// Step 2–3 of the upload flow: validate, then mint a 60s signed upload URL
// scoped to the participant's own folder. §11
export async function requestUploadUrl(): Promise<
  { ok: true; target: UploadTarget } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to submit." };

  const challenge = await getActiveChallenge();
  if (challenge.status !== "active") {
    return { ok: false, error: "The challenge isn't accepting submissions right now." };
  }

  const day = submittableDay(challenge);
  if (day == null) return { ok: false, error: "There's no open day to submit for." };

  const { data: existing } = await supabase
    .from("submissions")
    .select("id")
    .eq("challenge_id", challenge.id)
    .eq("participant_id", user.id)
    .eq("challenge_day", day)
    .maybeSingle();
  if (existing) return { ok: false, error: "You've already submitted for today." };

  const path = submissionStoragePath(challenge.slug, user.id, day);
  const { data, error } = await supabase.storage
    .from(SUBMISSIONS_BUCKET)
    .createSignedUploadUrl(path, { upsert: true });
  if (error || !data) return { ok: false, error: "Couldn't start the upload. Try again." };

  return { ok: true, target: { path: data.path, token: data.token, day } };
}

export interface CreateInput {
  day: number;
  hoursClaimed: number;
  topic: string;
  whatsappTime?: string | null;
}

export interface SubmitResult {
  ok: boolean;
  error?: string;
  rank?: number | null;
  activeCount?: number;
  hrsFromCut?: number | null;
  aboveCut?: boolean;
  day?: number;
}

// Step 5–6: re-validate server-side and insert. OCR + pHash are intentionally
// NOT computed here — they were stalling/slowing the submit path. screenshot_phash
// and ocr_extracted_hours are stored null; admins review the screenshot manually.
// Duplicate/OCR-mismatch flags are dropped for V1; the cheap flags remain. §critical-path
//
// screenshot_path is DERIVED here, never accepted from the caller. This action
// is independently callable, and it previously wrote whatever storagePath the
// client sent — so a crafted call could point a submission row at another
// participant's screenshot, and the reviewer would credit hours against the
// wrong evidence. Storage RLS stops you *uploading* outside your own folder; it
// does nothing about a row that merely references someone else's object.
// The day is still the caller's claim, but it is bounded by dayIsOpen (the
// documented 48h window, §10) and the path is built from the session user id,
// so the row can only ever reference the caller's own folder.
export async function createSubmission(input: CreateInput): Promise<SubmitResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to submit." };

  const challenge = await getActiveChallenge();
  if (challenge.status !== "active") {
    return { ok: false, error: "The challenge isn't accepting submissions right now." };
  }

  // Round to 2 decimals so minute precision (e.g. 7.75 = 7h45m) survives. §ISSUE-3
  const hours = Math.round(input.hoursClaimed * 100) / 100;
  if (!(hours > 0 && hours <= 24)) return { ok: false, error: "Hours must be between 0.1 and 24." };
  const topic = input.topic.trim().slice(0, 120);
  if (!topic) return { ok: false, error: "Tell us what you studied." };
  if (!dayIsOpen(challenge, input.day)) return { ok: false, error: "That day is closed." };

  // Cheap flags only — no image download/fingerprint on the critical path. §11
  const flags: string[] = [];
  const { data: priors } = await supabase
    .from("submissions")
    .select("status")
    .eq("challenge_id", challenge.id)
    .eq("participant_id", user.id);
  const rejectedCount = (priors ?? []).filter((p) => p.status === "rejected").length;
  if (rejectedCount >= 2) flags.push("participant_flagged");
  if (hours > 16) flags.push("excessive_hours");
  if (input.day < submittableDay(challenge)!) flags.push("submission_window_late");

  const hdrs = await headers();
  const ipRaw = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

  const { error: insErr } = await supabase.from("submissions").insert({
    challenge_id: challenge.id,
    participant_id: user.id,
    challenge_day: input.day,
    hours_claimed: hours,
    topic,
    screenshot_path: submissionStoragePath(challenge.slug, user.id, input.day),
    screenshot_phash: null,
    ocr_extracted_hours: null,
    whatsapp_post_time: input.whatsappTime || null,
    status: "pending",
    flag_reasons: flags,
    client_ip: ipRaw,
  });
  if (insErr) {
    if (insErr.code === "23505") return { ok: false, error: "You've already submitted for today." };
    return { ok: false, error: "Couldn't save your submission. Try again." };
  }

  await supabase.from("events").insert({
    user_id: user.id,
    name: "submission.create",
    payload: { day: input.day, hours, flags },
  });

  revalidatePath("/leaderboard");
  revalidatePath("/you");

  return { ok: true, day: input.day };
}
