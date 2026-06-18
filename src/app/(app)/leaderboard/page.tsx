import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getUser, getProfile, getActiveChallenge } from "@/lib/auth";
import { getLeaderboard } from "@/lib/leaderboard";
import { currentChallengeDay } from "@/lib/challenge";
import { toRoman } from "@/lib/format";
import { Eyebrow, Page, PrimaryButton } from "@/components/ui";
import { CampaignStrip, progressStates } from "@/components/CampaignStrip";
import { SettingsCog } from "@/components/SettingsCog";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { RefreshOnFocus } from "@/components/RefreshOnFocus";
import Link from "next/link";

export const revalidate = 30;

export default async function LeaderboardPage() {
  // Funnel incomplete onboarding (§9 step 6). Viewing doesn't require enrolment.
  const profile = await getProfile();
  if (!profile) redirect("/welcome");

  const challenge = await getActiveChallenge();
  const day = currentChallengeDay(challenge);

  return (
    <Page className="pt-10">
      <RefreshOnFocus />
      {/* Header — title left, campaign indicator right. §6.1 */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <Eyebrow>forge · the exam flame</Eyebrow>
          <h1 className="mt-2 font-serif text-[36px] leading-none text-primary">Leaderboard</h1>
        </div>
        <div className="flex items-start gap-2">
          <div className="flex flex-col items-end gap-2">
            <p className="font-serif text-[18px] italic leading-none">
              <span className="text-primary">{day > 0 ? toRoman(day) : "—"}</span>
              <span className="text-[#52525b]"> ╱ {toRoman(challenge.duration_days)}</span>
            </p>
            <CampaignStrip states={progressStates(challenge.duration_days, day)} size="sm" />
            <p className="font-mono text-[11px] text-tertiary">Updated moments ago</p>
          </div>
          <SettingsCog className="-mr-2.5 -mt-2.5" />
        </div>
      </header>

      <div className="mt-6 border-t border-[#27272a]" />

      <Suspense fallback={<BoardSkeleton />}>
        <Board challengeId={challenge.id} />
      </Suspense>
    </Page>
  );
}

async function Board({ challengeId: _challengeId }: { challengeId: string }) {
  const [user, challenge] = await Promise.all([getUser(), getActiveChallenge()]);
  const data = await getLeaderboard(challenge, user?.id ?? null);

  if (data.rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-6 py-24 text-center">
        <p className="font-serif text-[22px] italic text-primary">
          No blood drawn yet. Be the first.
        </p>
        <Link href="/submit" className="w-full max-w-[260px]">
          <PrimaryButton className="h-[52px]">Submit Day 1</PrimaryButton>
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mt-2">
        <LeaderboardTable rows={data.rows} prizeLine={data.prizeLine} />
      </div>

      <footer className="mt-3 border-t border-[#27272a] pt-6">
        <div className="flex items-center justify-between gap-4">
          <p className="font-mono text-[11px] text-tertiary" style={{ letterSpacing: "0.06em" }}>
            {data.activeCount} readers · {data.totalVerifiedHours} verified hours
            {data.disqualifiedCount > 0 ? ` · ${data.disqualifiedCount} disqualified` : ""}
          </p>
          <span className="font-mono text-[11px] text-accent">view all →</span>
        </div>
      </footer>
    </>
  );
}

// 1px-bordered placeholder matching the grid — no pulsing. §15
function BoardSkeleton() {
  return (
    <div className="mt-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="border-t border-[#27272a] py-4" />
      ))}
    </div>
  );
}
