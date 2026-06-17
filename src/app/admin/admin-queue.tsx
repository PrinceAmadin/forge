"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { reviewSubmission, updateNotes, disqualifyParticipant } from "./actions";
import { fmtHours, timeAgo } from "@/lib/format";

export interface QueueItem {
  id: string;
  participantId: string;
  fullName: string;
  course: string;
  hall: string | null;
  day: number;
  hoursClaimed: number;
  ocrHours: number | null;
  topic: string;
  whatsappTime: string | null;
  submittedAt: string;
  flags: string[];
  internalNotes: string | null;
  screenshotUrl: string | null;
  history: { confirmed: number; rejected: number; pending: number };
}

export function AdminQueue({ items: initial, challengeId }: { items: QueueItem[]; challengeId: string }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [index, setIndex] = useState(0);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [zoom, setZoom] = useState(false);
  const [dqOpen, setDqOpen] = useState(false);
  const reasonRef = useRef<HTMLInputElement>(null);

  const current = items[index];

  const afterResolve = useCallback(() => {
    setItems((prev) => {
      const next = prev.filter((_, i) => i !== index);
      setIndex((i) => Math.min(i, Math.max(0, next.length - 1)));
      return next;
    });
    setRejecting(false);
    setReason("");
    router.refresh();
  }, [index, router]);

  const confirm = useCallback(async () => {
    if (!current || busy) return;
    setBusy(true);
    setError(undefined);
    const res = await reviewSubmission(current.id, "confirmed");
    setBusy(false);
    if (!res.ok) return setError(res.error);
    afterResolve();
  }, [current, busy, afterResolve]);

  const submitReject = useCallback(async () => {
    if (!current || busy) return;
    setBusy(true);
    setError(undefined);
    const res = await reviewSubmission(current.id, "rejected", reason);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    afterResolve();
  }, [current, busy, reason, afterResolve]);

  const skip = useCallback(() => {
    setRejecting(false);
    setIndex((i) => (items.length === 0 ? 0 : (i + 1) % items.length));
  }, [items.length]);

  // Keyboard nav. §16 — ignore when typing in a field.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") {
        if (e.key === "Enter" && rejecting) {
          e.preventDefault();
          submitReject();
        }
        return;
      }
      switch (e.key.toLowerCase()) {
        case "j":
          setIndex((i) => Math.min(items.length - 1, i + 1));
          break;
        case "k":
          setIndex((i) => Math.max(0, i - 1));
          break;
        case "a":
          confirm();
          break;
        case "r":
          setRejecting(true);
          setTimeout(() => reasonRef.current?.focus(), 0);
          break;
        case "s":
          skip();
          break;
        case "enter":
          if (rejecting) submitReject();
          else confirm();
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items.length, rejecting, confirm, submitReject, skip]);

  if (items.length === 0) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-5 text-center">
        <p className="font-serif text-[22px] italic text-primary">Queue clear. Refresh to check again.</p>
        <button
          onClick={() => router.refresh()}
          className="rounded-md border border-[#3f3f46] px-5 py-3 text-[14px] text-primary active:border-[#52525b]"
        >
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh sm:flex">
      {/* Left list */}
      <aside className="border-b border-[#27272a] sm:h-dvh sm:w-[320px] sm:shrink-0 sm:overflow-y-auto sm:border-b-0 sm:border-r">
        <div className="border-b border-[#27272a] px-5 py-4">
          <p className="text-[10px] lowercase text-tertiary" style={{ letterSpacing: "0.22em" }}>
            forge · review queue
          </p>
          <p className="mt-1 font-mono text-[13px] text-secondary">{items.length} awaiting</p>
        </div>
        <ul>
          {items.map((it, i) => (
            <li key={it.id}>
              <button
                onClick={() => {
                  setIndex(i);
                  setRejecting(false);
                }}
                className={`block w-full border-b border-[#18181b] px-5 py-3 text-left transition-colors ${
                  i === index ? "you-tint" : "sm:hover:bg-zinc-900/40"
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[14px] text-primary">{it.fullName}</span>
                  <span className="font-mono text-[13px] tnum text-secondary">{fmtHours(it.hoursClaimed)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-tertiary">Day {it.day} · {timeAgo(it.submittedAt)}</span>
                  {it.flags.length > 0 && (
                    <span className="flex gap-1">
                      {it.flags.map((f) => (
                        <span
                          key={f}
                          className="rounded-[3px] bg-[#27272a] px-1.5 py-0.5 text-[9px] uppercase text-rejected"
                          style={{ letterSpacing: "0.08em" }}
                        >
                          {f.replace(/_/g, " ")}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Right detail */}
      {current && (
        <section className="flex-1 px-5 py-6 pb-32 sm:h-dvh sm:overflow-y-auto sm:px-8">
          <button
            type="button"
            onClick={() => setZoom(true)}
            className="block w-full overflow-hidden rounded-md border border-[#27272a]"
          >
            {current.screenshotUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.screenshotUrl} alt={`Day ${current.day} screenshot`} className="max-h-[420px] w-full object-contain bg-black" />
            ) : (
              <div className="flex h-48 items-center justify-center text-tertiary">No screenshot</div>
            )}
          </button>

          <div className="mt-6">
            <p className="text-[16px] text-primary">{current.fullName}</p>
            <p className="mt-1 text-[13px] text-tertiary">
              {[current.course, current.hall].filter(Boolean).join(" · ")}
            </p>
            <p className="mt-1 font-mono text-[12px] text-tertiary">
              {current.history.confirmed} confirmed · {current.history.rejected} rejected · {current.history.pending} pending
            </p>
          </div>

          <div className="mt-6 flex items-baseline gap-6">
            <div>
              <p className="text-[10px] lowercase text-tertiary" style={{ letterSpacing: "0.18em" }}>claimed</p>
              <p className="font-mono text-[28px] text-primary">{fmtHours(current.hoursClaimed)}</p>
            </div>
            {current.ocrHours != null && (
              <div>
                <p className="text-[10px] lowercase text-tertiary" style={{ letterSpacing: "0.18em" }}>ocr</p>
                <p className={`font-mono text-[18px] ${Math.abs(current.ocrHours - current.hoursClaimed) > 0.5 ? "text-accent" : "text-secondary"}`}>
                  {fmtHours(current.ocrHours)}
                </p>
              </div>
            )}
          </div>

          <div className="mt-5">
            <p className="text-[10px] lowercase text-tertiary" style={{ letterSpacing: "0.18em" }}>topic</p>
            <p className="mt-1 text-[14px] text-secondary">{current.topic}</p>
          </div>

          {current.whatsappTime && (
            <div className="mt-4">
              <p className="text-[10px] lowercase text-tertiary" style={{ letterSpacing: "0.18em" }}>whatsapp post</p>
              <p className="mt-1 font-mono text-[13px] text-secondary">{current.whatsappTime}</p>
            </div>
          )}

          <NotesField key={current.id} submissionId={current.id} initial={current.internalNotes ?? ""} />

          <button onClick={() => setDqOpen(true)} className="mt-6 text-[12px] text-rejected">
            Disqualify this participant
          </button>

          {error && <p className="mt-4 text-[13px] text-rejected">{error}</p>}

          {/* Actions — fixed to bottom for thumb reach. §16 */}
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#27272a] bg-bg px-5 py-3 pb-safe sm:left-[320px]">
            <div className="mx-auto max-w-[640px]">
              {rejecting ? (
                <div className="flex flex-col gap-2">
                  <input
                    ref={reasonRef}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason for rejection"
                    className="w-full rounded-md border border-[#27272a] bg-[#09090b] px-4 py-3 text-primary placeholder:text-[#52525b] focus:border-accent focus:outline-none"
                  />
                  <div className="flex gap-3">
                    <button onClick={() => setRejecting(false)} className="flex-1 rounded-md border border-[#3f3f46] py-3 text-[14px] text-primary">
                      Cancel
                    </button>
                    <button onClick={submitReject} disabled={busy || !reason.trim()} className="flex-1 rounded-md bg-rejected py-3 text-[14px] font-medium text-white disabled:opacity-50">
                      {busy ? "Rejecting…" : "Confirm rejection"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <button onClick={confirm} disabled={busy} className="flex-1 rounded-md bg-accent py-3 text-[15px] font-medium text-black active:bg-amber-600 disabled:opacity-50">
                    {busy ? "…" : "Confirm"}
                  </button>
                  <button onClick={() => { setRejecting(true); setTimeout(() => reasonRef.current?.focus(), 0); }} className="flex-1 rounded-md border border-[#3f3f46] py-3 text-[15px] text-primary active:border-[#52525b]">
                    Reject
                  </button>
                  <button onClick={skip} className="px-3 text-[14px] text-tertiary">Skip</button>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {zoom && current?.screenshotUrl && (
        <button onClick={() => setZoom(false)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current.screenshotUrl} alt="Screenshot" className="max-h-full max-w-full object-contain" />
        </button>
      )}

      {dqOpen && current && (
        <DisqualifyDialog
          challengeId={challengeId}
          participantId={current.participantId}
          name={current.fullName}
          onClose={() => setDqOpen(false)}
          onDone={() => {
            setDqOpen(false);
            afterResolve();
          }}
        />
      )}
    </div>
  );
}

function NotesField({ submissionId, initial }: { submissionId: string; initial: string }) {
  const [notes, setNotes] = useState(initial);
  const [saved, setSaved] = useState(false);
  return (
    <div className="mt-5">
      <p className="text-[10px] lowercase text-tertiary" style={{ letterSpacing: "0.18em" }}>internal notes</p>
      <textarea
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          setSaved(false);
        }}
        onBlur={async () => {
          await updateNotes(submissionId, notes);
          setSaved(true);
        }}
        rows={2}
        placeholder="Never shown to participants"
        className="mt-1 w-full rounded-md border border-[#27272a] bg-[#09090b] px-3 py-2 text-[13px] text-secondary placeholder:text-[#52525b] focus:border-accent focus:outline-none"
      />
      {saved && <p className="mt-1 text-[11px] text-verified">Saved</p>}
    </div>
  );
}

function DisqualifyDialog({
  challengeId,
  participantId,
  name,
  onClose,
  onDone,
}: {
  challengeId: string;
  participantId: string;
  name: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-[420px] border border-[#27272a] bg-bg p-5 sm:rounded-md">
        <p className="font-serif text-[20px] italic text-primary">Disqualify {name}?</p>
        <p className="mt-2 text-[13px] text-secondary">
          Their hours stop counting immediately. This is logged. Give a reason.
        </p>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason"
          autoFocus
          className="mt-4 w-full rounded-md border border-[#27272a] bg-[#09090b] px-4 py-3 text-primary placeholder:text-[#52525b] focus:border-accent focus:outline-none"
        />
        {error && <p className="mt-2 text-[13px] text-rejected">{error}</p>}
        <div className="mt-4 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-md border border-[#3f3f46] py-3 text-[14px] text-primary">
            Cancel
          </button>
          <button
            onClick={async () => {
              if (!reason.trim()) return;
              setBusy(true);
              const res = await disqualifyParticipant(challengeId, participantId, reason);
              setBusy(false);
              if (!res.ok) return setError(res.error);
              onDone();
            }}
            disabled={busy || !reason.trim()}
            className="flex-1 rounded-md bg-rejected py-3 text-[14px] font-medium text-white disabled:opacity-50"
          >
            {busy ? "…" : "Disqualify"}
          </button>
        </div>
      </div>
    </div>
  );
}
