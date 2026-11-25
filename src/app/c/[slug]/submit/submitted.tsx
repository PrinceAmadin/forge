"use client";

import Link from "next/link";
import { Eyebrow, PrimaryButton } from "@/components/ui";
import { padRank } from "@/lib/format";
import { formatHM } from "@/lib/time/format";
import { toRoman } from "@/lib/format";
import type { SubmitResult } from "./actions";

// The confirmation screen. §6.3 is explicit that this is "a moment, not a
// toast" — the previous flow redirected to /you with a one-line banner, which
// is the toast it says not to build.
//
// §2 is the reason: readers open Forge to find out where they stand, so every
// action should hand them back their standing. Hours are the means, rank is the
// end.
export function Submitted({
  slug,
  result,
  onSubmitAnother,
}: {
  slug: string;
  result: SubmitResult;
  onSubmitAnother: () => void;
}) {
  const { day, rank, activeCount, hrsFromCut, aboveCut } = result;

  // The submission is pending, so the rank shown is the one BEFORE these hours
  // are credited. Saying that is better than implying a move that has not
  // happened yet.
  const hasStanding = rank != null && activeCount != null;

  return (
    <div className="flex flex-col">
      <p className="font-serif text-[36px] leading-none text-primary">Done.</p>
      <p className="mt-3 text-[15px] text-secondary">
        {day != null ? (
          <>
            Day {day} <span className="text-tertiary">· {toRoman(day)}</span> logged. Awaiting
            verification.
          </>
        ) : (
          "Logged. Awaiting verification."
        )}
      </p>

      {hasStanding ? (
        <>
          <div className="mt-10 flex items-baseline gap-10">
            <div>
              <Eyebrow>your rank</Eyebrow>
              <p className="mt-1 font-serif text-[40px] italic leading-none text-primary">
                {padRank(rank)}
              </p>
            </div>
            <div>
              <Eyebrow>of</Eyebrow>
              <p className="mt-1 font-serif text-[40px] italic leading-none text-secondary">
                {activeCount}
              </p>
            </div>
          </div>

          {hrsFromCut != null && (
            <p className="mt-6 font-serif text-[20px] italic leading-snug text-primary">
              {aboveCut ? (
                <>
                  You&rsquo;re inside the cut by{" "}
                  <span className="text-accent">{formatHM(hrsFromCut, "long")}</span>.
                </>
              ) : (
                <>
                  <span className="text-accent">{formatHM(hrsFromCut, "long")}</span> from the cut.
                </>
              )}
            </p>
          )}

          <p className="mt-3 text-[13px] text-tertiary">
            Before today&rsquo;s hours are verified. They&rsquo;ll count once an admin confirms
            them.
          </p>
        </>
      ) : (
        <p className="mt-8 font-serif text-[18px] italic text-tertiary">
          Your standing updates once an admin confirms it.
        </p>
      )}

      <div className="mt-10 flex flex-col gap-3">
        <Link href={`/c/${slug}/leaderboard`}>
          <PrimaryButton className="h-[52px]">View leaderboard</PrimaryButton>
        </Link>
        {/* §6.3 asks for this: a reader catching up on a missed day shouldn't
            have to navigate back to the form. */}
        <button
          type="button"
          onClick={onSubmitAnother}
          className="py-2 font-serif text-[15px] italic text-accent"
        >
          Submit another day
        </button>
      </div>
    </div>
  );
}
