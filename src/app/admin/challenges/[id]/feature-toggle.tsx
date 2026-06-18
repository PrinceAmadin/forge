"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setMarksEnabled } from "./actions";

export function MarksToggle({ challengeId, initial }: { challengeId: string; initial: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function toggle() {
    if (busy) return;
    const next = !on;
    setBusy(true);
    setError(undefined);
    setOn(next); // optimistic
    const res = await setMarksEnabled(challengeId, next);
    setBusy(false);
    if (!res.ok) {
      setOn(!next);
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 border-y border-[#27272a] py-4">
        <div className="min-w-0">
          <p className="text-[14px] text-primary">Marks — public competitive callouts</p>
          <p className="mt-1 text-[12px] text-tertiary">
            Lets participants publicly mark up to 3 rivals to overtake. Marks are only allowed
            against users ranked above the marker.
          </p>
        </div>
        <button
          role="switch"
          aria-checked={on}
          aria-label="Toggle Marks"
          onClick={toggle}
          disabled={busy}
          className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-accent" : "bg-[#3f3f46]"}`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-black transition-all ${on ? "left-[22px]" : "left-0.5"}`}
          />
        </button>
      </div>
      {error && <p className="mt-2 text-[12px] text-rejected">{error}</p>}
    </div>
  );
}
