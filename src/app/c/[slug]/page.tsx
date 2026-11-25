import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { requireChallengeBySlug, getMyEnrolments } from "@/lib/challenges";
import { createClient } from "@/lib/supabase/server";
import { Eyebrow, PrimaryButton } from "@/components/ui";
import { Wordmark } from "@/components/nav/Wordmark";
import { SettingsCog } from "@/components/SettingsCog";
import { fmtNaira } from "@/lib/format";
import { formatDateRange, parseRules } from "@/lib/challenge";
import type { Challenge, PrizeTier } from "@/lib/types";
import { JoinBlock } from "./join-block";

export const dynamic = "force-dynamic";

// Status line under the wordmark, derived rather than hardcoded. §10
function statusEyebrow(challenge: Challenge): string {
  switch (challenge.status) {
    case "active":
      return "forge · live challenge";
    case "verification":
      return "forge · in verification";
    case "completed":
      return "forge · completed";
    case "draft":
      return "forge · draft — not yet live";
    default:
      return "forge · archived";
  }
}

// Italicise the final word so any challenge name keeps the brand cadence
// ("The Exam *Flame*", "Code *Habit*") without the name being baked into JSX.
function ChallengeTitle({ name }: { name: string }) {
  const words = name.trim().split(/\s+/);
  const last = words.pop() ?? name;
  return (
    <h1 className="mt-3 font-serif text-[48px] leading-[1.05] text-primary">
      {words.length > 0 && <>{words.join(" ")} </>}
      <span className="italic">{last}</span>
    </h1>
  );
}

export default async function ChallengePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const challenge = await requireChallengeBySlug(slug);

  // This page is public so the browse page can link straight to it. An
  // anonymous visitor sees everything except the join form.
  const user = await getUser();

  let enrolled = false;
  if (user) {
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    // A profile is required before enrolment, and the deep link is preserved
    // so the funnel lands back here afterwards. §9
    if (!profile) redirect(`/welcome?next=${encodeURIComponent(`/c/${challenge.slug}`)}`);

    enrolled = (await getMyEnrolments(user.id)).some((e) => e.challenge.id === challenge.id);
  }

  const rules = parseRules(challenge.rules);
  const prizes = (challenge.prize_structure ?? []) as PrizeTier[];

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[640px] px-5 pb-32 pt-12 sm:px-7">
      {/* This page sits outside the app shell (no rail/tab bar) — the wordmark
          is the consistent way home. PROBLEM-3. The cog carries the admin
          pending-work dot here too. */}
      <div className="mb-6 flex items-center justify-end gap-2">
        <Wordmark />
        <SettingsCog className="-mr-2.5" />
      </div>
      <Eyebrow accent>{statusEyebrow(challenge)}</Eyebrow>
      <ChallengeTitle name={challenge.name} />
      <p className="mt-3 text-[16px] text-secondary">{challenge.description}</p>
      <p className="mt-3 font-mono text-[12px] text-tertiary">{formatDateRange(challenge)}</p>

      {/* Prize structure — a clean list, not stat cards. §6.5
          Hidden entirely when a challenge offers nothing, so a friendly
          challenge doesn't show an empty "the prizes" heading. */}
      {prizes.length > 0 && (
        <section className="mt-10">
          <Eyebrow>the prizes</Eyebrow>
          <ul className="mt-4 flex flex-col gap-2.5">
            {prizes.map((tier) => (
              <li key={tier.label} className="flex items-baseline gap-5">
                <span className="w-16 font-serif text-[20px] italic text-accent">{tier.label}</span>
                <span className="font-serif text-[20px] text-primary">
                  {/* A tier need not carry money: a non-cash challenge
                      describes its reward in `note` instead. */}
                  {tier.amount != null ? fmtNaira(tier.amount) : (tier.note ?? "—")}
                  {tier.amount != null && tier.positions ? " each" : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {challenge.prize_note && (
        <p className="mt-6 font-serif text-[16px] italic text-secondary">{challenge.prize_note}</p>
      )}

      {/* Rules. §6.5 */}
      {rules.length > 0 && (
        <section className="mt-10">
          <Eyebrow>the rules</Eyebrow>
          <ol className="mt-4 flex flex-col gap-3">
            {rules.map((rule, i) => (
              <li key={i} className="flex gap-3 text-[14px] leading-[1.5] text-secondary">
                <span className="shrink-0 font-mono text-[12px] text-quaternary">{i + 1}</span>
                <span>{rule}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {!user ? (
        <div className="mt-12 flex flex-col gap-4">
          <Link href={`/auth?next=${encodeURIComponent(`/c/${challenge.slug}`)}`}>
            <PrimaryButton className="h-[52px]">Sign in to enter</PrimaryButton>
          </Link>
        </div>
      ) : enrolled ? (
        <div className="mt-12 flex flex-col gap-4">
          <p className="font-serif text-[22px] italic text-primary">You&rsquo;re in.</p>
          <Link href={`/c/${challenge.slug}/leaderboard`}>
            <PrimaryButton className="h-[52px]">Go to leaderboard</PrimaryButton>
          </Link>
        </div>
      ) : challenge.status !== "active" ? (
        <p className="mt-12 font-serif text-[18px] italic text-tertiary">
          {challenge.status === "draft"
            ? "This challenge hasn't opened yet."
            : "This challenge is closed to new entries."}
        </p>
      ) : (
        <JoinBlock slug={challenge.slug} challengeName={challenge.name} terms={challenge.terms} />
      )}
    </div>
  );
}
