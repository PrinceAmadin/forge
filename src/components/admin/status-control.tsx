"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eyebrow, PrimaryButton, SecondaryButton } from "@/components/ui";
import { setChallengeStatus } from "@/app/admin/challenges/[id]/actions";
import type { ChallengeStatus } from "@/lib/types";

const VERB: Record<ChallengeStatus, string> = {
  draft: "Return to draft",
  active: "Launch",
  verification: "Close submissions",
  completed: "Mark complete",
  archived: "Archive",
};

// Renders only the transitions the database will accept, so nothing offered
// here can fail on the graph check. The RPC re-checks everything regardless:
// this is the authority on what to *show*, not on what is allowed.
//
// `active` and `archived` require typing the challenge name. Both are
// effectively irreversible — launching lets participants in and locks the
// slug, start date and prize structure; archiving freezes everything with no
// un-archive — and a mis-click on either is not recoverable from the UI.
const NEEDS_TYPED_CONFIRMATION: ChallengeStatus[] = ["active", "archived"];

export function StatusControl({
  challengeId,
  challengeName,
  status,
  options,
  blocker,
  warnings,
}: {
  challengeId: string;
  challengeName: string;
  status: ChallengeStatus;
  options: ChallengeStatus[];
  /** Why launching is blocked, if it is. Only applies to the draft → active move. */
  blocker: string | null;
  warnings: Record<string, string | null>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<ChallengeStatus | null>(null);
  const [confirming, setConfirming] = useState<ChallengeStatus | null>(null);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function commit(next: ChallengeStatus) {
    setBusy(true);
    setError(undefined);
    const res = await setChallengeStatus(challengeId, next);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setConfirming(null);
    setPending(null);
    setTyped("");
    router.refresh();
  }

  function start(next: ChallengeStatus) {
    setError(undefined);
    if (NEEDS_TYPED_CONFIRMATION.includes(next)) {
      setConfirming(next);
      setTyped("");
    } else {
      setPending(next);
    }
  }

  if (options.length === 0) {
    return (
      <div className="mt-10">
        <Eyebrow>lifecycle</Eyebrow>
        <p className="mt-3 font-serif text-[16px] italic text-tertiary">
          Archived. Nothing more can change.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-10">
      <Eyebrow>lifecycle</Eyebrow>
      <p className="mt-2 font-mono text-[12px] text-tertiary">currently {status}</p>

      <div className="mt-4 flex flex-col gap-3">
        {options.map((next) => {
          const isLaunch = next === "active" && status === "draft";
          const disabled = isLaunch && blocker != null;
          return (
            <div key={next}>
              <SecondaryButton
                type="button"
                disabled={disabled || busy}
                onClick={() => start(next)}
                className={`h-11 ${disabled ? "opacity-50" : ""}`}
              >
                {VERB[next]}
              </SecondaryButton>
              {disabled && <p className="mt-2 text-[12px] text-rejected">{blocker}</p>}
              {!disabled && warnings[next] && (
                <p className="mt-2 text-[12px] text-tertiary">{warnings[next]}</p>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="mt-3 text-[13px] text-rejected">{error}</p>}

      {/* Simple confirm — for the reversible moves. */}
      {pending && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4">
          <div className="w-full max-w-[420px] border border-[#27272a] bg-bg p-5 sm:rounded-md">
            <p className="font-serif text-[20px] italic text-primary">{VERB[pending]}?</p>
            {warnings[pending] && (
              <p className="mt-2 text-[13px] text-secondary">{warnings[pending]}</p>
            )}
            <div className="mt-5 flex gap-3">
              <SecondaryButton onClick={() => setPending(null)} className="h-11">
                Cancel
              </SecondaryButton>
              <PrimaryButton onClick={() => commit(pending)} disabled={busy} className="h-11">
                {busy ? "Working…" : "Confirm"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* Typed confirm — for launch and archive. */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4">
          <div className="w-full max-w-[460px] border border-[#27272a] bg-bg p-5 sm:rounded-md">
            <p className="font-serif text-[20px] italic text-primary">{VERB[confirming]}?</p>
            {warnings[confirming] && (
              <p className="mt-2 text-[13px] text-secondary">{warnings[confirming]}</p>
            )}
            <p className="mt-4 text-[13px] text-tertiary">
              Type <span className="text-primary">{challengeName}</span> to confirm.
            </p>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoFocus
              className="mt-2 w-full rounded-md border border-[#27272a] bg-[#09090b] px-4 py-3 text-primary focus:border-accent focus:outline-none"
            />
            {error && <p className="mt-2 text-[13px] text-rejected">{error}</p>}
            <div className="mt-5 flex gap-3">
              <SecondaryButton
                onClick={() => {
                  setConfirming(null);
                  setTyped("");
                }}
                className="h-11"
              >
                Cancel
              </SecondaryButton>
              <PrimaryButton
                onClick={() => commit(confirming)}
                disabled={busy || typed.trim() !== challengeName}
                className="h-11"
              >
                {busy ? "Working…" : VERB[confirming]}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
