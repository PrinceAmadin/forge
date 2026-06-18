import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, getActiveChallenge } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Eyebrow, PrimaryButton } from "@/components/ui";
import { Wordmark } from "@/components/nav/Wordmark";
import { fmtNaira } from "@/lib/format";
import { formatDateRange } from "@/lib/challenge";
import type { PrizeTier } from "@/lib/types";
import { JoinBlock } from "./join-block";

export const dynamic = "force-dynamic";

function prizeRowLabel(tier: PrizeTier): string {
  return tier.label;
}

export default async function ExamFlamePage() {
  const user = await getUser();
  if (!user) redirect("/auth?next=/exam-flame");

  const challenge = await getActiveChallenge();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) redirect("/welcome");

  const { data: enrolment } = await supabase
    .from("challenge_participants")
    .select("id")
    .eq("challenge_id", challenge.id)
    .eq("participant_id", user.id)
    .maybeSingle();
  const enrolled = Boolean(enrolment);

  const rules = (challenge.rules ?? "")
    .split("\n")
    .map((r) => r.replace(/^\d+\.\s*/, "").trim())
    .filter(Boolean);

  const prizes = challenge.prize_structure ?? [];

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[640px] px-5 pb-32 pt-12 sm:px-7">
      {/* This page sits outside the app shell (no rail/tab bar) — the wordmark
          is the consistent way home. PROBLEM-3 */}
      <div className="mb-6 flex justify-end">
        <Wordmark />
      </div>
      <Eyebrow accent>forge · live challenge</Eyebrow>
      <h1 className="mt-3 font-serif text-[48px] leading-[1.05] text-primary">
        The Exam <span className="italic">Flame</span>
      </h1>
      <p className="mt-3 text-[16px] text-secondary">{challenge.description}</p>
      <p className="mt-3 font-mono text-[12px] text-tertiary">{formatDateRange(challenge)}</p>

      {/* Prize structure — a clean list, not stat cards. §6.5 */}
      <section className="mt-10">
        <Eyebrow>the prizes</Eyebrow>
        <ul className="mt-4 flex flex-col gap-2.5">
          {prizes.map((tier) => (
            <li key={prizeRowLabel(tier)} className="flex items-baseline gap-5">
              <span className="w-16 font-serif text-[20px] italic text-accent">
                {prizeRowLabel(tier)}
              </span>
              <span className="font-serif text-[20px] text-primary">
                {fmtNaira(tier.amount)}
                {tier.positions ? " each" : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Rules. §6.5 */}
      {rules.length > 0 && (
        <section className="mt-10">
          <Eyebrow>the rules</Eyebrow>
          <ol className="mt-4 flex list-none flex-col gap-3">
            {rules.map((rule, i) => (
              <li key={i} className="flex gap-3 text-[14px] text-secondary">
                <span className="font-mono text-[13px] text-tertiary">{i + 1}.</span>
                <span>{rule}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {enrolled ? (
        <div className="mt-12 flex flex-col gap-4">
          <p className="font-serif text-[22px] italic text-primary">You&rsquo;re in.</p>
          <Link href="/leaderboard">
            <PrimaryButton className="h-[52px]">Go to leaderboard</PrimaryButton>
          </Link>
        </div>
      ) : (
        <JoinBlock />
      )}
    </div>
  );
}
