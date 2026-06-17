"use client";

import { useActionState, useState } from "react";
import { joinChallenge, type JoinState } from "./actions";
import { PrimaryButton, FieldError } from "@/components/ui";

const TERMS = [
  "I understand that submissions require timer-screenshot evidence.",
  "I understand that fraudulent submissions result in disqualification.",
  "I understand that rankings come from verified submissions only.",
];

export function JoinBlock() {
  const [state, action, pending] = useActionState<JoinState, FormData>(joinChallenge, {});
  const [checked, setChecked] = useState<boolean[]>(Array(TERMS.length).fill(false));
  const allChecked = checked.every(Boolean);

  return (
    <form action={action} className="mt-12">
      <ul className="flex flex-col gap-4">
        {TERMS.map((term, i) => (
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
            {pending ? "Entering…" : "Enter the Exam Flame"}
          </PrimaryButton>
        </div>
      </div>
    </form>
  );
}
