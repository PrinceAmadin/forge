"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AppealResult = { ok: boolean; error?: string };

// Participant files one appeal against their own rejected submission. RLS
// (appeals_insert) already enforces ownership. §FIX-6
export async function createAppeal(
  submissionId: string,
  explanation: string,
  evidencePath: string | null
): Promise<AppealResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to appeal." };

  const trimmed = explanation.trim();
  if (trimmed.length < 20) return { ok: false, error: "Add at least 20 characters of justification." };

  const { data: sub } = await supabase
    .from("submissions")
    .select("id, participant_id, status")
    .eq("id", submissionId)
    .maybeSingle();
  if (!sub || sub.participant_id !== user.id) return { ok: false, error: "Submission not found." };
  if (sub.status !== "rejected") return { ok: false, error: "Only rejected submissions can be appealed." };

  const { data: existing } = await supabase
    .from("appeals")
    .select("id")
    .eq("submission_id", submissionId)
    .maybeSingle();
  if (existing) return { ok: false, error: "You've already appealed this submission." };

  const { error } = await supabase.from("appeals").insert({
    submission_id: submissionId,
    participant_explanation: trimmed,
    additional_evidence_path: evidencePath,
    status: "pending",
  });
  if (error) return { ok: false, error: "Couldn't submit your appeal. Try again." };

  redirect("/you?appealed=1");
}
