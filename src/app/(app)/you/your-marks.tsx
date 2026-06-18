"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eyebrow } from "@/components/ui";
import { padRank } from "@/lib/format";
import { formatHM } from "@/lib/time/format";
import { releaseMark } from "@/app/(app)/readers/actions";
import type { MarkStatus } from "@/lib/types";

export interface YourMarkRow {
  id: string;
  status: MarkStatus;
  targetRank: number;
  targetName: string;
  targetCourse: string;
  aheadHours: number; // target_hours - my_hours (can be negative once overtaken)
}

export function YourMarks({ marks, canMarkMore }: { marks: YourMarkRow[]; canMarkMore: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function release(id: string) {
    setBusy(id);
    await releaseMark(id);
    setBusy(null);
    router.refresh();
  }

  return (
    <section className="mt-8">
      <Eyebrow>your marks</Eyebrow>
      {marks.length === 0 ? (
        <p className="mt-3 font-serif text-[14px] italic text-tertiary">
          You haven&rsquo;t called anyone out yet.
        </p>
      ) : (
        <ul className="mt-3">
          {marks.map((m) => (
            <li key={m.id} className="flex items-center gap-4 border-t border-[#27272a] py-3">
              <span className="w-10 shrink-0 font-serif text-[22px] italic text-secondary">
                {padRank(m.targetRank)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] text-primary">{m.targetName}</span>
                <span className="block truncate text-[12px] text-tertiary">{m.targetCourse}</span>
              </span>
              <span className="shrink-0 text-right">
                {m.status === "fulfilled" ? (
                  <span className="font-serif text-[13px] italic text-accent">↟ overtaken</span>
                ) : m.status === "released" ? (
                  <span className="text-[12px] text-tertiary">released</span>
                ) : (
                  <>
                    <span className="block font-mono text-[13px] text-accent">
                      +{formatHM(Math.max(0, m.aheadHours), "long")} ahead
                    </span>
                    <button
                      onClick={() => release(m.id)}
                      disabled={busy === m.id}
                      className="mt-0.5 text-[12px] text-tertiary active:text-primary sm:hover:text-primary"
                    >
                      {busy === m.id ? "releasing…" : "release"}
                    </button>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {canMarkMore && (
        <Link href="/leaderboard" className="mt-3 inline-block font-serif text-[14px] italic text-accent">
          Mark another rival →
        </Link>
      )}
    </section>
  );
}
