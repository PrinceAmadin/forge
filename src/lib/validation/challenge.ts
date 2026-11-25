import { z } from "zod";
import { blankToUndefined, jsonField } from "@/lib/validation/form";
import type { PrizeTier } from "@/lib/types";

// Validation for creating and editing a challenge. Shared by the super-admin
// form and the server action, so the client cannot be the only thing enforcing
// an invariant.

// Slugs that would be confusing or ambiguous in a URL, independent of whether
// the router would actually collide today.
const RESERVED_SLUGS = new Set([
  "new",
  "edit",
  "admin",
  "api",
  "auth",
  "c",
  "challenges",
  "settings",
  "submissions",
  "welcome",
]);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------------------
// Prize tiers
//
// The builder works in {from, to} because a contiguous range is easier to edit
// and to validate than the stored {position} | {positions} union. Conversion to
// the stored shape happens in toPrizeStructureJson below.
// ---------------------------------------------------------------------------

export const prizeTierInput = z.object({
  from: z.coerce.number().int().min(1, "Positions start at 1"),
  to: z.coerce.number().int().min(1),
  amount: blankToUndefined(z.coerce.number().int().positive().optional()),
  label: z.string().trim().min(1, "Every tier needs a label").max(12),
  note: blankToUndefined(z.string().trim().max(80).optional()),
});

export type PrizeTierInput = z.output<typeof prizeTierInput>;

// Tiers must form an unbroken run starting at position 1: no gaps (position 4
// would win nothing while 5 does) and no overlaps (two tiers paying the same
// position). The builder UI makes this structurally hard to break, but the form
// is not the only caller.
export const prizeTiers = z
  .array(prizeTierInput)
  .superRefine((tiers, ctx) => {
    if (tiers.length === 0) return;
    const sorted = [...tiers].sort((a, b) => a.from - b.from);

    if (sorted[0]!.from !== 1) {
      ctx.addIssue({
        code: "custom",
        message: "The first tier must start at position 1",
        path: [0, "from"],
      });
    }

    sorted.forEach((tier, i) => {
      if (tier.to < tier.from) {
        ctx.addIssue({
          code: "custom",
          message: `Tier ${i + 1}: the last position is before the first`,
          path: [i, "to"],
        });
      }
      const prev = sorted[i - 1];
      if (prev && tier.from !== prev.to + 1) {
        ctx.addIssue({
          code: "custom",
          message:
            tier.from > prev.to + 1
              ? `Tier ${i + 1} leaves position ${prev.to + 1} unawarded`
              : `Tier ${i + 1} overlaps the tier above it`,
          path: [i, "from"],
        });
      }
    });
  });

// The highest position any tier covers — the prize line for a cash challenge.
export function lastCoveredPosition(tiers: PrizeTierInput[]): number {
  return tiers.reduce((max, t) => Math.max(max, t.to), 0);
}

// Convert to the stored JSONB shape: a single position collapses to
// {position}, a range to {positions}. Matches spec §10 and the shape the
// existing readers already consume.
export function toPrizeStructureJson(tiers: PrizeTierInput[]): PrizeTier[] {
  return [...tiers]
    .sort((a, b) => a.from - b.from)
    .map((t) => {
      const base = { label: t.label, ...(t.amount != null ? { amount: t.amount } : {}), ...(t.note ? { note: t.note } : {}) };
      return t.from === t.to
        ? { ...base, position: t.from }
        : { ...base, positions: [t.from, t.to] as [number, number] };
    });
}

// Read the stored shape back into builder rows, for the edit form.
export function fromPrizeStructureJson(tiers: PrizeTier[]): PrizeTierInput[] {
  return tiers.map((t) => ({
    from: t.positions ? t.positions[0] : t.position,
    to: t.positions ? t.positions[1] : t.position,
    amount: t.amount,
    label: t.label,
    note: t.note,
  }));
}

// ---------------------------------------------------------------------------
// The challenge itself
// ---------------------------------------------------------------------------

export const challengeFields = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "At least 3 characters")
    .max(40)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Lowercase letters, numbers and single hyphens only")
    .refine((s) => !RESERVED_SLUGS.has(s), "That slug is reserved"),
  name: z.string().trim().min(3, "Give the challenge a name").max(80),
  description: blankToUndefined(z.string().trim().max(500).optional()),
  rules: blankToUndefined(z.string().trim().max(4000).optional()),
  terms: blankToUndefined(z.string().trim().max(2000).optional()),

  start_date: z.string().regex(ISO_DATE, "Pick a start date"),
  end_date: z.string().regex(ISO_DATE, "Pick an end date"),
  timezone: blankToUndefined(z.string().trim().max(60).default("Africa/Lagos")),
  daily_hour_ceiling: blankToUndefined(z.coerce.number().min(0.5).max(24).default(24)),

  visibility: z.enum(["listed", "unlisted"]).default("listed"),
  reward_kind: z.enum(["cash", "none", "custom"]).default("cash"),
  prize_note: blankToUndefined(z.string().trim().max(200).optional()),

  // The honours line. For a cash challenge it is derived from the tiers and
  // asserted below; for a friendly one it is whatever rank the organiser wants
  // to celebrate.
  prize_line_position: z.coerce.number().int().min(1, "The cut must be at least 1"),

  prize_structure: jsonField(prizeTiers.default([])),
});

// Cross-field rules. Kept in one place so create and edit cannot disagree.
function checkChallenge(
  v: z.output<typeof challengeFields>,
  ctx: z.RefinementCtx
): void {
  if (v.end_date < v.start_date) {
    ctx.addIssue({
      code: "custom",
      message: "The end date is before the start date",
      path: ["end_date"],
    });
  }

  if (v.reward_kind === "cash") {
    if (v.prize_structure.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "A cash challenge needs at least one prize tier",
        path: ["prize_structure"],
      });
      return;
    }
    const missingAmount = v.prize_structure.some((t) => t.amount == null);
    if (missingAmount) {
      ctx.addIssue({
        code: "custom",
        message: "Every tier of a cash challenge needs an amount",
        path: ["prize_structure"],
      });
    }
    // The cut IS the last paid position — the form renders it read-only, and
    // this is the assertion that keeps a hand-built request honest.
    const last = lastCoveredPosition(v.prize_structure);
    if (v.prize_line_position !== last) {
      ctx.addIssue({
        code: "custom",
        message: `The cut must be ${last}, the last position that wins a prize`,
        path: ["prize_line_position"],
      });
    }
    return;
  }

  // Not a cash challenge: no money anywhere.
  if (v.prize_structure.some((t) => t.amount != null)) {
    ctx.addIssue({
      code: "custom",
      message: "Remove the amounts, or set the reward to cash",
      path: ["prize_structure"],
    });
  }
}

export const challengeCreate = challengeFields.superRefine(checkChallenge);

// Editing cannot change the slug — it is the public URL and the first segment
// of every screenshot's storage path, so renaming it would orphan every upload.
// Which of the remaining fields are actually editable depends on status; that
// is enforced by editableFields() plus the database trigger from 0016.
export const challengeEdit = challengeFields.omit({ slug: true }).superRefine(
  (v, ctx) => checkChallenge({ ...v, slug: "unused" }, ctx)
);

export type ChallengeCreateInput = z.output<typeof challengeCreate>;
export type ChallengeEditInput = z.output<typeof challengeEdit>;

// Fields a challenge still allows to be changed, given where it is in its
// lifecycle. Spec §10: everything freezes at archived, and the identity and
// contract fields freeze as soon as it leaves draft.
const ALWAYS_EDITABLE = [
  "name",
  "description",
  "rules",
  "terms",
  "visibility",
  "daily_hour_ceiling",
  "prize_note",
] as const;

const DRAFT_ONLY = [
  "slug",
  "start_date",
  "timezone",
  "reward_kind",
  "prize_structure",
  "prize_line_position",
] as const;

export function editableFields(status: string): ReadonlySet<string> {
  if (status === "archived") return new Set();
  if (status === "draft") return new Set([...ALWAYS_EDITABLE, ...DRAFT_ONLY, "end_date"]);
  // Past draft: copy and flags stay editable, and the end date may only be
  // extended (the bound itself is checked by the action and the DB trigger).
  return new Set([...ALWAYS_EDITABLE, "end_date"]);
}
