"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperAdmin, getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { describeError } from "@/lib/errors";
import { parseForm } from "@/lib/validation/form";
import { challengeCreate, toPrizeStructureJson } from "@/lib/validation/challenge";

export type CreateChallengeState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

const FALLBACK = "Couldn't create the challenge — check server logs";

// Mentions the migration by name because the columns below arrive with it, and
// the failure is otherwise a bare Postgres string. Same approach as
// setMarksEnabled, which does this for 0009.
const MISSING_COLUMNS =
  "The database is missing the challenge platform columns. Apply " +
  "supabase/migrations/0014_challenge_platform.sql, then try again.";

export async function createChallenge(
  _prev: CreateChallengeState,
  formData: FormData
): Promise<CreateChallengeState> {
  await requireSuperAdmin();

  const parsed = parseForm(challengeCreate, formData);
  if (!parsed.ok) {
    return {
      error: parsed.formErrors[0] ?? "Some fields need fixing.",
      fieldErrors: parsed.fieldErrors,
    };
  }
  const v = parsed.value;

  const supabase = await createClient();
  const me = await getUser();

  // A clear message beats a unique-violation code: the slug is the public URL,
  // so a collision is a thing the author can actually fix.
  const { data: clash } = await supabase
    .from("challenges")
    .select("id")
    .eq("slug", v.slug)
    .maybeSingle();
  if (clash) {
    return {
      error: "A challenge already uses that slug.",
      fieldErrors: { slug: ["Already taken"] },
    };
  }

  // duration_days is a generated column — never include it.
  const row = {
    slug: v.slug,
    name: v.name,
    description: v.description ?? null,
    rules: v.rules ?? null,
    terms: v.terms ?? null,
    start_date: v.start_date,
    end_date: v.end_date,
    timezone: v.timezone,
    daily_hour_ceiling: v.daily_hour_ceiling,
    visibility: v.visibility,
    reward_kind: v.reward_kind,
    prize_note: v.prize_note ?? null,
    prize_structure: toPrizeStructureJson(v.prize_structure),
    prize_line_position: v.prize_line_position,
    created_by: me?.id ?? null,
    // Always born as a draft. Going live is a separate, audited decision
    // (admin_set_challenge_status, 1.11) rather than a side effect of saving a
    // form — a challenge that opened the moment it was typed would be worse.
    status: "draft" as const,
  };

  let created: { id: string; slug: string } | null = null;
  try {
    const { data, error } = await supabase
      .from("challenges")
      .insert(row)
      .select("id, slug")
      .single();
    if (error) {
      // 42703 = undefined_column, i.e. migration 0014 has not been applied.
      if (error.code === "42703") return { error: MISSING_COLUMNS };
      if (error.code === "23505") {
        return { error: "A challenge already uses that slug.", fieldErrors: { slug: ["Already taken"] } };
      }
      return { error: describeError(error, FALLBACK) };
    }
    created = data;
  } catch (e) {
    return { error: describeError(e, FALLBACK) };
  }

  if (!created) return { error: FALLBACK };

  await supabase.rpc("write_audit", {
    p_action: "challenge.create",
    p_entity_type: "challenge",
    p_entity_id: created.id,
    p_previous: null,
    p_new: {
      slug: created.slug,
      name: v.name,
      status: "draft",
      reward_kind: v.reward_kind,
      prize_line_position: v.prize_line_position,
    },
  });

  revalidatePath("/admin/challenges");
  revalidatePath("/challenges");

  // redirect() throws, so it must sit outside the try/catch above.
  redirect(`/admin/challenges/${created.id}`);
}
