import Link from "next/link";
import { getUser } from "@/lib/auth";
import { listChallenges } from "@/lib/challenges";
import { Eyebrow, Page } from "@/components/ui";
import { Wordmark } from "@/components/nav/Wordmark";
import { SettingsCog } from "@/components/SettingsCog";
import { fmtNaira } from "@/lib/format";
import { formatDateRange } from "@/lib/challenge";

export const dynamic = "force-dynamic";

// Where a participant finds a challenge to enter. Public: the whole point is
// that it can be shared, so an anonymous visitor sees the same list and signs
// in from the challenge's own page.
export default async function ChallengesPage() {
  const user = await getUser();
  const items = await listChallenges({ viewerId: user?.id ?? null });

  return (
    <Page className="pt-10">
      <div className="mb-3 flex items-center justify-end gap-2">
        <Wordmark />
        {user && <SettingsCog className="-mr-2.5" />}
      </div>

      <header>
        <Eyebrow>forge</Eyebrow>
        <h1 className="mt-2 font-serif text-[36px] leading-none text-primary">Challenges</h1>
      </header>

      <div className="mt-6 border-t border-[#27272a]" />

      {items.length === 0 ? (
        <div className="py-24 text-center">
          <p className="font-serif text-[22px] italic text-primary">
            Nothing burning right now.
          </p>
          <p className="mt-3 text-[14px] text-tertiary">
            The next challenge will show up here when it opens.
          </p>
        </div>
      ) : (
        <ul className="max-w-[640px]">
          {items.map(({ challenge, participantCount, prizePool, viewerEnrolled }) => (
            <li key={challenge.id}>
              <Link
                href={`/c/${challenge.slug}`}
                className="block border-b border-[#27272a] py-5 transition-colors active:bg-zinc-900/40 sm:hover:bg-zinc-900/40"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-serif text-[22px] text-primary">{challenge.name}</span>
                  {viewerEnrolled && (
                    <span className="shrink-0 font-serif text-[13px] italic text-accent">
                      you&rsquo;re in
                    </span>
                  )}
                </div>

                {challenge.description && (
                  <p className="mt-1.5 text-[14px] leading-[1.45] text-secondary">
                    {challenge.description}
                  </p>
                )}

                <p
                  className="mt-2.5 font-mono text-[11px] text-tertiary"
                  style={{ letterSpacing: "0.06em" }}
                >
                  {[
                    formatDateRange(challenge),
                    `${participantCount} ${participantCount === 1 ? "reader" : "readers"}`,
                    // A friendly challenge has no pool, so don't show ₦0.
                    prizePool > 0 ? `${fmtNaira(prizePool)} pool` : challenge.prize_note,
                    challenge.status !== "active" ? challenge.status : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
