"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CenteredPage, PrimaryButton, TextInput, Label, FieldError } from "@/components/ui";

export function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/leaderboard";

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setPending(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { shouldCreateUser: true },
    });

    setPending(false);
    if (error) {
      setError("That didn't go through. Try again.");
      return;
    }
    const q = new URLSearchParams({ email: trimmed, next });
    router.push(`/auth/verify?${q.toString()}`);
  }

  return (
    <CenteredPage>
      <div className="mb-12 flex flex-col gap-3 text-center">
        <p className="font-serif text-[32px] italic leading-none text-accent">Forge</p>
        <p className="text-[14px] text-secondary">Where readers go to war.</p>
      </div>

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        <div>
          <Label htmlFor="email">Enter your email</Label>
          <TextInput
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="h-12"
          />
          <FieldError>{error}</FieldError>
        </div>
        <PrimaryButton type="submit" disabled={pending || !email.trim()} className="h-[52px]">
          {pending ? "Sending…" : "Send code"}
        </PrimaryButton>
      </form>

      <p
        className="mt-10 text-center text-[11px] text-tertiary"
        style={{ letterSpacing: "0.06em" }}
      >
        By continuing you accept the rules of the challenge you join.
      </p>
    </CenteredPage>
  );
}
