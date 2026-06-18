"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { requestUploadUrl, createSubmission, type SubmitResult } from "./actions";
import { PrimaryButton, TextInput, Label, FieldError } from "@/components/ui";
import { fmtHours } from "@/lib/format";

function CameraIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2L8 5h8l1.5 2h2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-9Z"
        stroke="#71717A"
        strokeWidth="1.5"
      />
      <circle cx="12" cy="13" r="3.25" stroke="#71717A" strokeWidth="1.5" />
    </svg>
  );
}

// Compress to ≤1500px longest edge, JPEG 0.85. Skips if already small. §11
async function compress(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const longest = Math.max(bitmap.width, bitmap.height);
  const scale = longest > 1500 ? 1500 / longest : 1;
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.85)
  );
}

export function SubmitForm({ day, userId: _userId }: { day: number; userId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string>();
  const [file, setFile] = useState<File>();
  const [hours, setHours] = useState("");
  const [topic, setTopic] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<SubmitResult>();

  const canSubmit = hours.trim() !== "" && topic.trim() !== "" && Boolean(file) && !pending;

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function clearPhoto() {
    setFile(undefined);
    setPreview(undefined);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    const h = Number(hours);
    if (!Number.isFinite(h) || h <= 0 || h > 24) {
      setError("Hours must be between 0.1 and 24.");
      return;
    }
    if (!file) return;
    setPending(true);

    const target = await requestUploadUrl();
    if (!target.ok) {
      setError(target.error);
      setPending(false);
      return;
    }

    const blob = await compress(file);
    const supabase = createClient();
    const { error: upErr } = await supabase.storage
      .from("submissions")
      .uploadToSignedUrl(target.target.path, target.target.token, blob, {
        contentType: "image/jpeg",
      });
    if (upErr) {
      setError("The upload didn't go through. Try again.");
      setPending(false);
      return;
    }

    const result = await createSubmission({
      day: target.target.day,
      hoursClaimed: h,
      topic: topic.trim(),
      storagePath: target.target.path,
      whatsappTime: whatsapp.trim() || null,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone(result);
  }

  if (done) {
    return (
      <div className="flex flex-col gap-5">
        <p className="font-serif text-[36px] italic leading-none text-primary">Done.</p>
        <p className="text-[14px] text-secondary">Day {done.day} logged. Awaiting verification.</p>
        {done.rank != null && (
          <div className="text-[13px]">
            <p className="text-primary">
              You are #{done.rank} of {done.activeCount} active
            </p>
            <p className={done.aboveCut ? "text-tertiary" : "text-accent"}>
              {done.hrsFromCut == null
                ? "—"
                : done.aboveCut
                  ? `${fmtHours(done.hrsFromCut)} hrs above the cut`
                  : `${fmtHours(done.hrsFromCut)} hrs to cross`}
            </p>
          </div>
        )}
        <div className="mt-2 flex flex-col gap-3">
          <Link href="/leaderboard">
            <PrimaryButton className="h-[52px]">View leaderboard</PrimaryButton>
          </Link>
          <button
            onClick={() => router.refresh()}
            className="text-[13px] text-tertiary"
          >
            Back to today
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      {/* Hours — large serif italic, bottom border only. §6.3 */}
      <div>
        <Label htmlFor="hours">Hours read today</Label>
        <input
          id="hours"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          inputMode="decimal"
          placeholder="8.5"
          className="w-full border-b border-[#27272a] bg-transparent pb-2 text-right font-serif text-[48px] italic text-primary placeholder:text-[#3f3f46] focus:border-accent focus:outline-none"
        />
      </div>

      <div>
        <Label htmlFor="topic">What did you study?</Label>
        <TextInput
          id="topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          maxLength={120}
          placeholder="e.g., Engineering economics, Chapter 5"
        />
      </div>

      {/* Screenshot dropzone. §6.3 */}
      <div>
        <Label>Timer screenshot</Label>
        {/* No `capture`: lets mobile offer Photo Library + Take Photo + Files,
            so users can upload an existing screenshot. §FIX-1 */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={onPick}
          className="sr-only"
          id="screenshot"
        />
        {preview ? (
          <div className="relative h-40 w-full overflow-hidden rounded-md border border-[#27272a]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Your timer screenshot" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={clearPhoto}
              className="absolute right-2 top-2 rounded-md bg-black/70 px-2 py-1 text-[12px] text-primary"
            >
              × Remove
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-40 w-full flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed border-[#3f3f46] transition-colors active:border-accent sm:hover:border-accent"
          >
            <CameraIcon />
            <span className="text-[14px] text-secondary">Tap to upload your timer screenshot</span>
          </button>
        )}
      </div>

      <div>
        <Label htmlFor="whatsapp">What time did you post in the WhatsApp group?</Label>
        <TextInput
          id="whatsapp"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          inputMode="numeric"
          placeholder="e.g., 22:14"
        />
      </div>

      <FieldError>{error}</FieldError>

      {/* In-flow (not fixed): the layout's bottom padding keeps it clear of the
          tab bar, so it never hides behind the nav on mobile. §FIX-2 */}
      <PrimaryButton type="submit" disabled={!canSubmit} className="h-14 text-[16px]">
        {pending ? "Submitting…" : "Submit for verification"}
      </PrimaryButton>
    </form>
  );
}
