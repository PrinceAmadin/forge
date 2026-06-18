"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CenteredPage, FieldError } from "@/components/ui";

const LEN = 6;

export function VerifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const rawNext = params.get("next");
  const next = rawNext ?? "/leaderboard";

  const [digits, setDigits] = useState<string[]>(Array(LEN).fill(""));
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(30);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  useEffect(() => {
    if (!email) router.replace("/auth");
  }, [email, router]);

  async function verify(code: string) {
    setError(undefined);
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    if (error) {
      // Surface the real Supabase reason (wrong code, expired, rate-limited…)
      // and re-enable the inputs for another try.
      setPending(false);
      setError(error.message);
      setDigits(Array(LEN).fill(""));
      inputs.current[0]?.focus();
      return;
    }
    // Success: keep the "Verifying…" state up through navigation — don't clear
    // pending, or the inputs flash back to active for a frame before redirect.
    // Session cookies are written by the client; the destination's middleware /
    // page routes to /welcome or /exam-flame as needed.
    router.replace(next);
    router.refresh();
  }

  function setAt(i: number, value: string) {
    const next = [...digits];
    next[i] = value;
    setDigits(next);
    const code = next.join("");
    if (code.length === LEN && !next.includes("")) verify(code);
  }

  function onChange(i: number, raw: string) {
    const v = raw.replace(/\D/g, "");
    if (!v) {
      setAt(i, "");
      return;
    }
    if (v.length > 1) {
      // Paste of the whole code.
      const chars = v.slice(0, LEN).split("");
      const filled = Array(LEN)
        .fill("")
        .map((_, idx) => chars[idx] ?? "");
      setDigits(filled);
      if (filled.join("").length === LEN) verify(filled.join(""));
      else inputs.current[Math.min(chars.length, LEN - 1)]?.focus();
      return;
    }
    setAt(i, v);
    if (i < LEN - 1) inputs.current[i + 1]?.focus();
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  }

  async function resend() {
    if (cooldown > 0) return;
    const supabase = createClient();
    await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    setCooldown(30);
  }

  return (
    <CenteredPage>
      <div className="mb-10 flex flex-col gap-3 text-center">
        <h1 className="font-serif text-[32px] leading-none text-primary">Check your email</h1>
        <p className="text-[14px] text-secondary">
          We sent a 6-digit code to <span className="text-primary">{email}</span>.
        </p>
      </div>

      <div className="flex justify-center gap-2" role="group" aria-label="Verification code">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              inputs.current[i] = el;
            }}
            value={d}
            onChange={(e) => onChange(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={LEN}
            aria-label={`Digit ${i + 1}`}
            autoFocus={i === 0}
            disabled={pending}
            className="h-14 w-10 rounded-md border border-[#27272a] bg-[#09090b] text-center font-mono text-[22px] text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-amber-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
          />
        ))}
      </div>

      <div className="mt-4 text-center">
        <FieldError>{error}</FieldError>
        {pending && <p className="text-[14px] text-secondary">Verifying…</p>}
      </div>

      <div className="mt-8 flex flex-col items-center gap-3">
        <button
          onClick={resend}
          disabled={cooldown > 0}
          className="text-[14px] text-accent disabled:text-tertiary"
        >
          {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </button>
        <button
          onClick={() => router.push(rawNext ? `/auth?next=${encodeURIComponent(rawNext)}` : "/auth")}
          className="text-[14px] text-accent"
        >
          Use a different email
        </button>
      </div>
    </CenteredPage>
  );
}
