"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PrimaryButton, SecondaryButton } from "@/components/ui";
import { createMark } from "../actions";

export function MarkButton({
  targetId,
  targetName,
  canMark,
  reason,
  remainingAfter,
}: {
  targetId: string;
  targetName: string;
  canMark: boolean;
  reason?: string;
  remainingAfter: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  if (!canMark) {
    return (
      <div className="mt-10">
        <button
          disabled
          className="w-full rounded-md bg-[#27272a] py-3 font-medium text-tertiary"
        >
          Mark this reader
        </button>
        {reason && <p className="mt-2 text-center text-[12px] text-tertiary">{reason}</p>}
      </div>
    );
  }

  async function confirm() {
    setBusy(true);
    setError(undefined);
    const res = await createMark(targetId);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="mt-10">
      <PrimaryButton onClick={() => setOpen(true)} className="h-12">
        Mark this reader
      </PrimaryButton>
      {error && <p className="mt-2 text-center text-[12px] text-rejected">{error}</p>}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-[420px] border border-[#27272a] bg-bg p-5 sm:rounded-md">
            <p className="font-serif text-[20px] italic text-primary">Mark {targetName}?</p>
            <p className="mt-2 text-[13px] text-secondary">
              You&rsquo;ll have {remainingAfter} mark{remainingAfter === 1 ? "" : "s"} remaining.
              Marks are public.
            </p>
            <div className="mt-5 flex gap-3">
              <SecondaryButton onClick={() => setOpen(false)} className="h-11">
                Cancel
              </SecondaryButton>
              <PrimaryButton onClick={confirm} disabled={busy} className="h-11">
                {busy ? "Marking…" : "Confirm mark"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
