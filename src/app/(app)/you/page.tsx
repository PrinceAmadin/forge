import Link from "next/link";
import { requireOnboardedViewer, getActiveChallenge, getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getLeaderboard } from "@/lib/leaderboard";
import { currentChallengeDay, submittableDay } from "@/lib/challenge";
import { formatHM } from "@/lib/time/format";
import { padRank } from "@/lib/format";
import { marksEnabled } from "@/lib/marks";
import { Eyebrow, Page } from "@/components/ui";
import { CampaignStrip, type CellState } from "@/components/CampaignStrip";
import { SettingsCog } from "@/components/SettingsCog";
import { YourMarks, type YourMarkRow } from "./your-marks";
import type { Submission } from "@/lib/types";

export const dynamic = "force-dynamic";

function statusLabel(s: string): string {
  return s === "confirmed" ? "Confirmed" : s === "rejected" ? "Rejected" : "Awaiting verification";
}
function statusColor(s: string): string {
  return s === "confirmed" ? "text-primary" : s === "rejected" ? "text-rejected" : "text-accent";
}

export default async function YouPage({
  searchParams,
}: {
  searchParams: Promise<{ appealed?: string }>;
}) {
  const profile = await requireOnboardedViewer();
  const { appealed } = await searchParams;
  const [challenge, user] = await Promise.all([getActiveChallenge(), getUser()]);
  const supabase = await createClient();

  const [{ data: hall }, { data: subsRaw }, board] = await Promise.all([
    profile.hall_id
      ? supabase.from("halls").select("name").eq("id", profile.hall_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("submissions")
      .select(
        "id, challenge_day, hours_claimed, hours_credited, topic, status, submitted_at, rejection_reason"
      )
      .eq("challenge_id", challenge.id)
      .eq("participant_id", user!.id)
      .order("challenge_day", { ascending: false }),
    getLeaderboard(challenge, user!.id),
  ]);

  const subs = (subsRaw ?? []) as Pick<
    Submission,
    "id" | "challenge_day" | "hours_claimed" | "hours_credited" | "topic" | "status" | "submitted_at" | "rejection_reason"
  >[];

  const me = board.rows.find((r) => r.participant_id === user!.id);
  const totalHours = me?.total_hours ?? 0;
  const day = currentChallengeDay(challenge);

  // Rivalry. §6.2
  const ahead = me && !me.is_disqualified ? board.rows.find((r) => r.rank === me.rank - 1 && !r.is_disqualified) : undefined;
  const behind = me && !me.is_disqualified ? board.rows.find((r) => r.rank === me.rank + 1 && !r.is_disqualified) : undefined;
  const aheadGap = ahead && me ? Math.round((ahead.total_hours - me.total_hours) * 10) / 10 : null;
  const behindGap = behind && me ? Math.round((me.total_hours - behind.total_hours) * 10) / 10 : null;

  // Above/below cut. §6.2
  const aboveCut = me ? me.rank <= board.prizeLine : true;
  const lastIn = board.rows.find((r) => !r.is_disqualified && r.rank === board.prizeLine);
  const firstOut = board.rows.find((r) => !r.is_disqualified && r.rank === board.prizeLine + 1);
  let cutGap: number | null = null;
  if (me && aboveCut && firstOut) cutGap = Math.round((me.total_hours - firstOut.total_hours) * 10) / 10;
  else if (me && !aboveCut && lastIn) cutGap = Math.round((lastIn.total_hours - me.total_hours) * 10) / 10;

  // Campaign strip from submissions. §6.2
  const byDay = new Map(subs.map((s) => [s.challenge_day, s.status]));
  const states: CellState[] = Array.from({ length: challenge.duration_days }, (_, i) => {
    const d = i + 1;
    const status = byDay.get(d);
    if (status === "confirmed") return "done";
    if (status === "pending") return "pending";
    if (status === "rejected") return "rejected";
    if (d === day) return "today";
    if (d < day) return "skipped";
    return "future";
  });

  const submittedToday = byDay.has(submittableDay(challenge) ?? -1);

  // Marks. §Marks — gated; queried only when enabled (forward-safe otherwise).
  const showMarks = marksEnabled(challenge) && !!me;
  const rowById = new Map(board.rows.map((r) => [r.participant_id, r]));
  const yourMarks: YourMarkRow[] = [];
  const marksOnYou: { rank: number; name: string; course: string; behindHours: number }[] = [];
  let activeMarkCount = 0;
  if (showMarks) {
    const { data: mk } = await supabase
      .from("marks")
      .select("id, status, marker_user_id, target_user_id")
      .eq("challenge_id", challenge.id)
      .or(`marker_user_id.eq.${user!.id},target_user_id.eq.${user!.id}`);
    for (const m of mk ?? []) {
      if (m.marker_user_id === user!.id) {
        if (m.status === "active") activeMarkCount++;
        const t = rowById.get(m.target_user_id);
        yourMarks.push({
          id: m.id,
          status: m.status,
          targetRank: t?.rank ?? 0,
          targetName: t?.full_name ?? "—",
          targetCourse: t?.course ?? "",
          aheadHours: t && me ? Math.round((t.total_hours - me.total_hours) * 100) / 100 : 0,
        });
      } else if (m.status === "active") {
        const mr = rowById.get(m.marker_user_id);
        marksOnYou.push({
          rank: mr?.rank ?? 0,
          name: mr?.full_name ?? "—",
          course: mr?.course ?? "",
          behindHours: mr && me ? Math.round((me.total_hours - mr.total_hours) * 100) / 100 : 0,
        });
      }
    }
    yourMarks.sort((a, b) => Number(a.status !== "active") - Number(b.status !== "active") || a.targetRank - b.targetRank);
    marksOnYou.sort((a, b) => a.rank - b.rank);
  }

  return (
    <Page className="pt-10">
      <div className="pb-28 sm:pb-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Eyebrow>you</Eyebrow>
            <h1 className="mt-2 font-serif text-[36px] leading-none text-primary">{profile.full_name}</h1>
            <p className="mt-2 text-[13px] text-tertiary">
              {[profile.course, hall?.name, profile.academic_level].filter(Boolean).join(" · ")}
            </p>
          </div>
          <SettingsCog className="-mr-2.5 -mt-2" />
        </div>

        {appealed && (
          <p className="mt-6 rounded-md border border-[#27272a] px-4 py-3 text-[13px] text-secondary">
            Appeal submitted. The team will review it.
          </p>
        )}

        {/* Hero number. §6.2 */}
        <div className="mt-8">
          <p className="font-serif text-[64px] italic leading-none text-primary sm:text-[128px]">
            {formatHM(totalHours, "compact")}
          </p>
          <p className="mt-2 text-[12px] lowercase text-tertiary" style={{ letterSpacing: "0.18em" }}>
            hours
          </p>
        </div>

        {/* Rivalry block. §6.2 */}
        <div className="mt-8 flex flex-col gap-3">
          {me?.rank === 1 ? (
            <p className="font-serif text-[18px] italic text-primary">Leading the field.</p>
          ) : (
            <RivalryRow label="chasing" name={ahead?.full_name} value={aheadGap != null ? `+${formatHM(aheadGap, "long")} ahead` : null} accent />
          )}
          {behind ? (
            <RivalryRow label="chased by" name={behind.full_name} value={behindGap != null ? `−${formatHM(behindGap, "long")} behind` : null} />
          ) : (
            <p className="text-[13px] text-tertiary">No one chasing you yet.</p>
          )}
        </div>

        {/* Rank block. §6.2 */}
        <div className="mt-8 text-[13px]">
          <p className="text-primary">
            You are <span className="font-mono">#{me?.rank ?? "—"}</span> of {board.activeCount} active
          </p>
          <p className={cutColor(aboveCut, cutGap)}>
            {cutGap == null
              ? "—"
              : aboveCut
                ? `${formatHM(cutGap, "long")} above the cut`
                : `${formatHM(cutGap, "long")} below the cut`}
          </p>
        </div>

        {/* Marks. §Marks — only when the feature is enabled. */}
        {showMarks && (
          <>
            <YourMarks marks={yourMarks} canMarkMore={activeMarkCount < 3} />
            <section className="mt-8">
              <Eyebrow>marks on you</Eyebrow>
              {marksOnYou.length === 0 ? (
                <p className="mt-3 font-serif text-[14px] italic text-tertiary">
                  Nobody&rsquo;s chasing you yet.
                </p>
              ) : (
                <ul className="mt-3">
                  {marksOnYou.map((m, i) => (
                    <li key={i} className="flex items-center gap-4 border-t border-[#27272a] py-3">
                      <span className="w-10 shrink-0 font-serif text-[22px] italic text-secondary">{padRank(m.rank)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] text-primary">{m.name}</span>
                        <span className="block truncate text-[12px] text-tertiary">{m.course}</span>
                      </span>
                      <span className="shrink-0 font-mono text-[13px] text-tertiary">
                        −{formatHM(Math.max(0, m.behindHours), "long")} behind
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        {/* Campaign strip. §6.2 */}
        <div className="mt-8 overflow-x-auto">
          <CampaignStrip states={states} size="lg" />
        </div>

        {/* Submission list. §6.2 */}
        <div className="mt-8">
          {subs.length === 0 ? (
            <p className="text-[14px] text-tertiary">The race hasn&rsquo;t started for you yet.</p>
          ) : (
            <ul>
              {subs.map((s) => {
                const isManual = s.topic.startsWith("Manual entry");
                return (
                  <li key={s.id} className="border-t border-[#27272a]">
                    <Link href={`/submissions/${s.id}`} className="block py-4 transition-colors active:bg-zinc-900/40 sm:hover:bg-zinc-900/40">
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="text-[14px] text-primary">Day {s.challenge_day}</span>
                        <span className={`font-mono text-[13px] tnum ${statusColor(s.status)}`}>
                          {formatHM(s.hours_credited ?? s.hours_claimed, "compact")}
                        </span>
                      </div>
                      <p className={`mt-1 font-serif text-[11px] italic ${statusColor(s.status)}`}>
                        {statusLabel(s.status)}
                      </p>
                      {/* Manual credits are shown transparently. §FIX-5 */}
                      <p className={`mt-1 truncate text-[12px] ${isManual ? "italic text-tertiary" : "text-secondary"}`}>
                        {isManual ? "Manual entry" : s.topic}
                      </p>
                      {s.status === "rejected" && s.rejection_reason && (
                        <p className="mt-1 text-[12px] text-rejected">{s.rejection_reason}</p>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Sticky CTA only when today is unsubmitted. §13.6 */}
      {!submittedToday && submittableDay(challenge) != null && (
        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-[#27272a] bg-bg px-5 py-3 pb-safe sm:hidden">
          <Link
            href="/submit"
            className="block w-full rounded-md bg-accent py-3 text-center font-medium text-black active:bg-amber-600"
          >
            Submit today&rsquo;s reading
          </Link>
        </div>
      )}
    </Page>
  );
}

function cutColor(aboveCut: boolean, gap: number | null): string {
  if (!aboveCut) return "text-accent";
  if (gap != null && gap < 5) return "text-primary"; // in danger
  return "text-tertiary";
}

function RivalryRow({
  label,
  name,
  value,
  accent,
}: {
  label: string;
  name?: string;
  value: string | null;
  accent?: boolean;
}) {
  if (!name) return null;
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="w-24 shrink-0 text-[11px] lowercase text-tertiary" style={{ letterSpacing: "0.12em" }}>
        {label}
      </span>
      <span className="flex-1 text-[14px] text-primary">{name}</span>
      <span className={`font-mono text-[14px] ${accent ? "text-accent" : "text-secondary"}`}>{value}</span>
    </div>
  );
}
