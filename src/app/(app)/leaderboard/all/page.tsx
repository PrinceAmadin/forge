import { redirect } from "next/navigation";
import { getUser, getProfile, getActiveChallenge } from "@/lib/auth";
import { getLeaderboard } from "@/lib/leaderboard";
import { marksEnabled, getLeaderboardMarks } from "@/lib/marks";
import { formatHM } from "@/lib/time/format";
import { Page } from "@/components/ui";
import { PageHeader } from "@/components/nav/page-header";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { RealtimeRefresh } from "@/components/realtime/realtime-refresh";

export const dynamic = "force-dynamic";

// The full register — every enrolled reader, no truncation. The cut divider
// still marks position prizeLine→prizeLine+1 but nothing below it is dropped.
export default async function AllReadersPage() {
  const profile = await getProfile();
  if (!profile) redirect("/welcome");

  const [user, challenge] = await Promise.all([getUser(), getActiveChallenge()]);
  const data = await getLeaderboard(challenge, user?.id ?? null);
  const marks = marksEnabled(challenge) ? await getLeaderboardMarks(challenge.id) : null;

  return (
    <>
      <PageHeader title="All readers" backHref="/leaderboard" />
      <RealtimeRefresh table="submissions" event="UPDATE" filter="status=eq.confirmed" />
      <RealtimeRefresh table="challenge_participants" event="INSERT" />
      <Page className="pt-6">
        <div className="max-w-[760px]">
          {data.rows.length === 0 ? (
            <p className="py-16 text-center font-serif text-[18px] italic text-tertiary">
              No readers yet.
            </p>
          ) : (
            <>
              <LeaderboardTable
                rows={data.rows}
                prizeLine={data.prizeLine}
                marksAgainst={marks?.againstCount}
                overtakes={marks?.recentOvertakes}
              />
              <footer className="mt-3 border-t border-[#27272a] pt-6">
                <p className="font-mono text-[11px] text-tertiary" style={{ letterSpacing: "0.06em" }}>
                  {data.activeCount} readers · {formatHM(data.totalVerifiedHours, "long")} verified
                  {data.disqualifiedCount > 0 ? ` · ${data.disqualifiedCount} disqualified` : ""}
                </p>
              </footer>
            </>
          )}
        </div>
      </Page>
    </>
  );
}
