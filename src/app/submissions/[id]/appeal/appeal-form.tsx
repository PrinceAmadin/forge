"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createAppeal } from "../../actions";
import { PrimaryButton, Label, FieldError } from "@/components/ui";

export function AppealForm({ submissionId, userId }: { submissionId: string; userId: string }) {
  const [explanation, setExplanation] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [evidenceName, setEvidenceName] = useState<string>();
  const [evidenceFile, setEvidenceFile] = useState<File>();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    if (explanation.trim().length < 20) {
      setError("Add at least 20 characters of justification.");
      return;
    }
    setPending(true);

    let evidencePath: string | null = null;
    if (evidenceFile) {
      // Stored under the participant's own folder, satisfying the existing
      // submissions-bucket RLS (foldername[2] === uid).
      const path = `appeals/${userId}/${submissionId}.jpg`;
      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from("submissions")
        .upload(path, evidenceFile, { upsert: true, contentType: evidenceFile.type });
      if (upErr) {
        setError("Couldn't upload that evidence. Try again or submit without it.");
        setPending(false);
        return;
      }
      evidencePath = path;
    }

    const res = await createAppeal(submissionId, explanation, evidencePath);
    // On success the action redirects; only failures return here.
    if (res && !res.ok) {
      setError(res.error);
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5" noValidate>
      <div>
        <Label htmlFor="explanation">Your justification</Label>
        <textarea
          id="explanation"
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          rows={5}
          placeholder="Explain why this submission should be reconsidered."
          className="w-full rounded-md border border-[#27272a] bg-[#09090b] px-4 py-3 text-[14px] text-primary placeholder:text-[#52525b] focus:border-accent focus:outline-none focus:ring-1 focus:ring-amber-500/20"
        />
      </div>

      <div>
        <Label htmlFor="evidence">Additional evidence (optional)</Label>
        <input
          id="evidence"
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            setEvidenceFile(f);
            setEvidenceName(f?.name);
          }}
          className="block w-full text-[13px] text-tertiary file:mr-3 file:rounded-md file:border-0 file:bg-[#27272a] file:px-4 file:py-2 file:text-primary"
        />
        {evidenceName && <p className="mt-2 text-[12px] text-tertiary">{evidenceName}</p>}
      </div>

      <FieldError>{error}</FieldError>

      <PrimaryButton type="submit" disabled={pending || explanation.trim().length < 20} className="h-12">
        {pending ? "Sending…" : "Send appeal"}
      </PrimaryButton>
    </form>
  );
}
