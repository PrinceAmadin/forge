import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Eyebrow, Page } from "@/components/ui";
import { PageHeader } from "@/components/nav/page-header";
import { fmtNaira } from "@/lib/format";
import {
  formatDateRange,
  launchBlocker,
  nextStatuses,
  parseRules,
  parseTerms,
  prizePool,
  rewardKind,
  transitionWarning,
} from "@/lib/challenge";
import type { Challenge, ChallengeStatus, PrizeTier } from "@/lib/types";
import { MarksToggle } from "./feature-toggle";
import { StatusControl } from "@/components/admin/status-control";

export const dynamic = "force-dynamic";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-[#27272a] py-2.5">
      <span className="shrink-0 text-[13px] text-tertiary">{label}</span>
      <span className="text-right text-[13px] text-primary">{children}</span>
    </div>
  );
}

export default async function AdminChallengePage({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperAdmin();
  const { id } = await params;
  const supabase = await createClient();

  // select("*") so marks_enabled is read if present, undefined if pre-migration.
  const { data, error } = await supabase.from("challenges").select("*").eq("id", id).maybeSingle();
  if (error || !data) notFound();
  const challenge = data as Challenge;

  const pool = prizePool(challenge);
  const reward = rewardKind(challenge);
  const tiers = (challenge.prize_structure ?? []) as PrizeTier[];
  const options = nextStatuses(challenge.status);
  const blocker = launchBlocker(challenge);

  // Enrolment count decides how reversible a launch really is: with people
  // already in, the locked fields matter a great deal more.
  const { count: participants } = await supabase
    .from("challenge_participants")
    .select("*", { count: "exact", head: true })
    .eq("challenge_id", challenge.id);

  const warnings: Record<string, string | null> = {};
  for (const next of options) warnings[next] = transitionWarning(next);

  return (
    <>
      <PageHeader title={challenge.name} backHref="/admin/challenges" />
      <Page className="pt-8">
        <div className="max-w-[560px] pb-28 sm:pb-12">
          <p className="font-mono text-[12px] text-tertiary">
            {challenge.status} · {formatDateRange(challenge)}
          </p>
          <Link
            href={`/c/${challenge.slug}`}
            className="mt-2 inline-block font-mono text-[11px] text-accent"
          >
            /c/{challenge.slug} →
          </Link>

          {/* Everything a super admin should read before launching. The page
              previously showed status, dates and the pool and nothing else. */}
          <section className="mt-8">
            <Eyebrow>configuration</Eyebrow>
            <div className="mt-3">
              <Row label="Participants">{participants ?? 0}</Row>
              <Row label="Duration">{challenge.duration_days} days</Row>
              <Row label="Timezone">{challenge.timezone}</Row>
              <Row label="Daily cap">{challenge.daily_hour_ceiling}h</Row>
              <Row label="Visibility">{challenge.visibility ?? "listed"}</Row>
              <Row label="Reward">{reward}</Row>
              <Row label="The cut">{challenge.prize_line_position}</Row>
              {reward === "cash" && <Row label="Total pool">{fmtNaira(pool)}</Row>}
              {challenge.prize_note && <Row label="Reward note">{challenge.prize_note}</Row>}
              <Row label="Rules">{parseRules(challenge.rules).length} lines</Row>
              <Row label="Entry terms">
                {parseTerms(challenge.terms).length > 0
                  ? `${parseTerms(challenge.terms).length} lines`
                  : "standard"}
              </Row>
            </div>
          </section>

          {tiers.length > 0 && (
            <section className="mt-8">
              <Eyebrow>prizes</Eyebrow>
              <div className="mt-3">
                {tiers.map((tier) => (
                  <Row
                    key={tier.label}
                    label={
                      tier.positions
                        ? `${tier.label} · positions ${tier.positions[0]}–${tier.positions[1]}`
                        : `${tier.label} · position ${tier.position}`
                    }
                  >
                    {tier.amount != null ? fmtNaira(tier.amount) : (tier.note ?? "—")}
                  </Row>
                ))}
              </div>
            </section>
          )}

          <StatusControl
            challengeId={challenge.id}
            challengeName={challenge.name}
            status={challenge.status as ChallengeStatus}
            options={options}
            blocker={blocker}
            warnings={warnings}
          />

          <section className="mt-10">
            <Eyebrow>features</Eyebrow>
            <div className="mt-3">
              <MarksToggle challengeId={challenge.id} initial={challenge.marks_enabled === true} />
            </div>
          </section>
        </div>
      </Page>
    </>
  );
}
