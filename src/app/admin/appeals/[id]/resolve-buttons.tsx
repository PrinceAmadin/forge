"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PrimaryButton, SecondaryButton, FieldError } from "@/components/ui";
import { resolveAppeal } from "../actions";

export function ResolveButtons({ appealId }: { appealId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"upheld" | "restored" | null>(null);
  const [error, setError] = useState<string>();

  async function resolve(decision: "upheld" | "restored") {
    setError(undefined);
    setBusy(decision);
    const res = await resolveAppeal(appealId, decision);
    if (!res.ok) {
      setError(res.error);
      setBusy(null);
      return;
    }
    router.push("/admin/appeals");
    router.refresh();
  }

  return (
    <div className="mt-10 flex flex-col gap-3">
      <FieldError>{error}</FieldError>
      <PrimaryButton onClick={() => resolve("restored")} disabled={busy !== null} className="h-12">
        {busy === "restored" ? "Restoring…" : "Restore submission"}
      </PrimaryButton>
      <SecondaryButton onClick={() => resolve("upheld")} disabled={busy !== null} className="h-12">
        {busy === "upheld" ? "Upholding…" : "Uphold rejection"}
      </SecondaryButton>
    </div>
  );
}
