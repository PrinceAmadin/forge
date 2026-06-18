import { notFound, redirect } from "next/navigation";
import { getUser, getActiveChallenge } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getLeaderboard } from "@/lib/leaderboard";
import { marksEnabled, markEligibility } from "@/lib/marks";
import { Eyebrow, Page } from "@/components/ui";
import { BackButton } from "@/components/BackButton";
import { formatHM } from "@/lib/time/format";
import { padRank } from "@/lib/format";
import { MarkButton } from "./mark-button";

export const dynamic = "force-dynamic";

export default async function ReaderProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const user = await getUser();
  if (!user) redirect("/auth");

  const challenge = await getActiveChallenge();
  const board = await getLeaderboard(challenge, user.id);
  const target = board.rows.find((r) => r.participant_id === userId);
  if (!target) notFound();
  const viewer = board.rows.find((r) => r.participant_id === user.id);

  const enabled = marksEnabled(challenge);
  let canMark = false;
  let reason: string | undefined;
  let remainingAfter = 0;
  let fulfilledStat: { fulfilled: number; total: number } | null = null;

  if (enabled) {
    const supabase = await createClient();
    const [{ data: mine }, { data: theirs }, { data: already }] = await Promise.all([
      supabase.from("marks").select("id").eq("challenge_id", challenge.id).eq("marker_user_id", user.id).eq("status", "active"),
      supabase.from("marks").select("status").eq("challenge_id", challenge.id).eq("marker_user_id", userId),
      supabase.from("marks").select("id").eq("challenge_id", challenge.id).eq("marker_user_id", user.id).eq("target_user_id", userId).eq("status", "active").maybeSingle(),
    ]);
    const activeCount = mine?.length ?? 0;
    const elig = markEligibility(viewer, target, activeCount, Boolean(already));
    canMark = elig.canMark && user.id !== userId;
    reason = user.id === userId ? undefined : elig.reason;
    remainingAfter = Math.max(0, 3 - (activeCount + 1));
    if ((theirs ?? []).length > 0) {
      fulfilledStat = {
        fulfilled: (theirs ?? []).filter((m) => m.status === "fulfilled").length,
        total: (theirs ?? []).length,
      };
    }
  }

  return (
    <Page className="pt-10">
      <div className="max-w-[480px]">
        <BackButton href="/leaderboard" />
        <div className="mt-3">
          <Eyebrow>reader</Eyebrow>
          <h1 className="mt-2 font-serif text-[36px] leading-none text-primary">{target.full_name}</h1>
          <p className="mt-2 text-[13px] text-tertiary">
            {[target.course, target.hall_name].filter(Boolean).join(" · ")}
          </p>
        </div>

        <div className="mt-8 flex items-baseline gap-8">
          <div>
            <Eyebrow>rank</Eyebrow>
            <p className="mt-1 font-serif text-[28px] italic text-primary">{padRank(target.rank)}</p>
          </div>
          <div>
            <Eyebrow>hours</Eyebrow>
            <p className="mt-1 font-serif text-[28px] italic text-primary">{formatHM(target.total_hours, "compact")}</p>
          </div>
          <div>
            <Eyebrow>days</Eyebrow>
            <p className="mt-1 font-mono text-[24px] text-secondary">{target.verified_days}</p>
          </div>
        </div>

        {fulfilledStat && (
          <p className="mt-6 text-[10px] lowercase text-tertiary" style={{ letterSpacing: "0.18em" }}>
            {fulfilledStat.fulfilled} / {fulfilledStat.total} marks fulfilled
          </p>
        )}

        {enabled && user.id !== userId && (
          <MarkButton
            targetId={userId}
            targetName={target.full_name}
            canMark={canMark}
            reason={reason}
            remainingAfter={remainingAfter}
          />
        )}
      </div>
    </Page>
  );
}
