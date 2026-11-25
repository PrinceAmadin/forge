"use client";

import { useActionState, useState } from "react";
import { joinChallenge, type JoinState } from "./actions";
import { PrimaryButton, FieldError } from "@/components/ui";
import { parseTerms } from "@/lib/challenge";

// Used when a challenge has no `terms` of its own. These are the three
// acknowledgements that were hardcoded here before migration 0014 gave
// challenges a terms column — keeping them as the fallback means behaviour is
// identical before and after that migration is applied, and any challenge that
// sets its own terms overrides them.
const FALLBACK_TERMS = [
  "I understand that submissions require timer-screenshot evidence.",
  "I understand that fraudulent submissions result in disqualification.",
  "I understand that rankings come from verified submissions only.",
];

export function JoinBlock({
  slug,
  challengeName,
  terms,
}: {
  slug: string;
  challengeName: string;
  terms?: string | null;
}) {
  const [state, action, pending] = useActionState<JoinState, FormData>(joinChallenge, {});
  const parsed = parseTerms(terms);
  const items = parsed.length > 0 ? parsed : FALLBACK_TERMS;
  const [checked, setChecked] = useState<boolean[]>(Array(items.length).fill(false));
  const allChecked = checked.every(Boolean);

  return (
    <form action={action} className="mt-12">
      {/* The action re-reads and re-validates the slug server-side; this only
          tells it which challenge the form was rendered for. */}
      <input type="hidden" name="slug" value={slug} />

      <ul className="flex flex-col gap-4">
        {items.map((term, i) => (
          <li key={i}>
            <label className="flex cursor-pointer items-start gap-3 text-[14px] text-secondary">
              <input
                type="checkbox"
                checked={checked[i]}
                onChange={(e) => {
                  const next = [...checked];
                  next[i] = e.target.checked;
                  setChecked(next);
                }}
                className="mt-0.5 h-5 w-5 shrink-0 accent-amber-500"
              />
              <span>{term}</span>
            </label>
          </li>
        ))}
      </ul>

      <FieldError>{state.error}</FieldError>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#27272a] bg-bg px-5 py-3 pb-safe sm:static sm:mt-8 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
        <div className="mx-auto max-w-[640px]">
          <PrimaryButton type="submit" disabled={!allChecked || pending} className="h-[52px]">
            {pending ? "Entering…" : `Enter ${challengeName}`}
          </PrimaryButton>
        </div>
      </div>
    </form>
  );
}
