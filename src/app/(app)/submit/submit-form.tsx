"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { requestUploadUrl, createSubmission } from "./actions";
import { PrimaryButton, TextInput, Label, FieldError } from "@/components/ui";
import { hmToDecimalHours, normalizeHM } from "@/lib/time/format";

type Step = "idle" | "uploading" | "saving" | "done";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB — block huge images before they stall.

// Reject after `ms` with a real message so the UI never sticks on a hung promise.
function timeoutAfter<T = never>(ms: number, message: string): Promise<T> {
  return new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms));
}

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
  const [hrs, setHrs] = useState("");
  const [mins, setMins] = useState("");
  const [topic, setTopic] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [whatsappErr, setWhatsappErr] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [step, setStep] = useState<Step>("idle");

  const hasTime = Number(hrs || 0) > 0 || Number(mins || 0) > 0;
  const canSubmit = hasTime && topic.trim() !== "" && Boolean(file) && !pending;

  // Normalize minutes >= 60 into hours on blur (e.g. 90m → 1h 30m). §ISSUE-3
  function normalizeOnBlur() {
    const h = Number(hrs || 0);
    const m = Number(mins || 0);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return;
    if (m >= 60) {
      const n = normalizeHM(h, m);
      setHrs(String(n.h));
      setMins(String(n.m));
    }
  }

  // WhatsApp time: keep digits + colon, auto-insert ":" after 2 digits. §ISSUE-2
  function onWhatsappChange(raw: string) {
    let v = raw.replace(/[^\d:]/g, "");
    const digits = v.replace(/:/g, "");
    if (!v.includes(":") && digits.length > 2) {
      v = `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
    }
    setWhatsapp(v.slice(0, 5));
    setWhatsappErr(undefined);
  }

  function validateWhatsapp() {
    if (whatsapp && !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(whatsapp)) {
      setWhatsappErr("Use HH:MM format, like 22:14");
    } else {
      setWhatsappErr(undefined);
    }
  }

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

  // Critical path only: signed-URL → compress → upload (25s cap) → insert.
  // No OCR, no pHash on the client. Each step advances the button label.
  async function submitFlow(decimal: number, theFile: File): Promise<void> {
    const target = await requestUploadUrl();
    if (!target.ok) throw new Error(target.error);

    const blob = await compress(theFile);

    const supabase = createClient();
    const upload = supabase.storage
      .from("submissions")
      .uploadToSignedUrl(target.target.path, target.target.token, blob, {
        contentType: "image/jpeg",
      });
    const { error: upErr } = await Promise.race([
      upload,
      timeoutAfter<{ error: { message: string } | null }>(
        25000,
        "Upload timed out. Check your connection and try again."
      ),
    ]);
    if (upErr) throw new Error(upErr.message || "The upload didn't go through. Try again.");

    setStep("saving");
    const result = await createSubmission({
      day: target.target.day,
      hoursClaimed: decimal,
      topic: topic.trim(),
      storagePath: target.target.path,
      whatsappTime: whatsapp.trim() || null,
    });
    if (!result.ok) throw new Error(result.error || "Couldn't save your submission. Try again.");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    const h = Number(hrs || 0);
    const m = Number(mins || 0);
    if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || m < 0) {
      setError("Enter valid hours and minutes.");
      return;
    }
    const decimal = hmToDecimalHours(h, m);
    if (decimal <= 0 || decimal > 24) {
      setError("Enter between 1 minute and 24 hours.");
      return;
    }
    if (!file) return;
    // Block oversized images before we waste 30s timing out on them. §guard
    if (file.size > MAX_BYTES) {
      setError("Screenshot too large. Please use a smaller image.");
      return;
    }

    setPending(true);
    setStep("uploading");
    try {
      // Hard overall cap so the button can never stick on a hung promise.
      await Promise.race([
        submitFlow(decimal, file),
        timeoutAfter(30000, "Submit timed out. Check your connection and try again."),
      ]);
      setStep("done");
      router.push("/you?submitted=1");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Submit failed. Try again.");
      setStep("idle");
      setPending(false);
    }
  }

  const submitLabel =
    step === "uploading"
      ? "Uploading screenshot…"
      : step === "saving"
        ? "Saving submission…"
        : step === "done"
          ? "Submitted ✓"
          : "Submit for verification";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      {/* Time read today — hours + minutes, large serif. §ISSUE-3 */}
      <div>
        <Label>Time read today</Label>
        <div className="flex items-end gap-6">
          <div className="flex-1">
            <p className="mb-1 text-[10px] lowercase text-tertiary" style={{ letterSpacing: "0.22em" }}>
              hours
            </p>
            <input
              id="hours"
              value={hrs}
              onChange={(e) => setHrs(e.target.value.replace(/[^\d]/g, "").slice(0, 2))}
              onBlur={normalizeOnBlur}
              inputMode="numeric"
              placeholder="8"
              aria-label="Hours read"
              className="w-full border-b border-[#27272a] bg-transparent pb-2 text-right font-serif text-[48px] italic text-primary placeholder:text-[#3f3f46] focus:border-accent focus:outline-none"
            />
          </div>
          <div className="flex-1">
            <p className="mb-1 text-[10px] lowercase text-tertiary" style={{ letterSpacing: "0.22em" }}>
              minutes
            </p>
            <input
              id="minutes"
              value={mins}
              onChange={(e) => setMins(e.target.value.replace(/[^\d]/g, "").slice(0, 2))}
              onBlur={normalizeOnBlur}
              inputMode="numeric"
              placeholder="30"
              aria-label="Minutes read"
              className="w-full border-b border-[#27272a] bg-transparent pb-2 text-right font-serif text-[48px] italic text-primary placeholder:text-[#3f3f46] focus:border-accent focus:outline-none"
            />
          </div>
        </div>
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
          type="text"
          value={whatsapp}
          onChange={(e) => onWhatsappChange(e.target.value)}
          onBlur={validateWhatsapp}
          inputMode="numeric"
          pattern="^([01][0-9]|2[0-3]):[0-5][0-9]$"
          maxLength={5}
          placeholder="22:14"
        />
        {whatsappErr && <p className="mt-2 text-[12px] text-rejected">{whatsappErr}</p>}
      </div>

      <FieldError>{error}</FieldError>

      {/* In-flow (not fixed): the layout's bottom padding keeps it clear of the
          tab bar, so it never hides behind the nav on mobile. §FIX-2 */}
      <PrimaryButton type="submit" disabled={!canSubmit} className="h-14 text-[16px]">
        {submitLabel}
      </PrimaryButton>
    </form>
  );
}
