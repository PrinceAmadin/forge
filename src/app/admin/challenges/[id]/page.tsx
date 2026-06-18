import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Eyebrow, Page } from "@/components/ui";
import { BackButton } from "@/components/BackButton";
import { fmtNaira } from "@/lib/format";
import type { Challenge, PrizeTier } from "@/lib/types";
import { MarksToggle } from "./feature-toggle";

export const dynamic = "force-dynamic";

export default async function AdminChallengePage({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperAdmin();
  const { id } = await params;
  const supabase = await createClient();

  // select("*") so marks_enabled is read if present, undefined if pre-migration.
  const { data, error } = await supabase.from("challenges").select("*").eq("id", id).maybeSingle();
  if (error || !data) notFound();
  const challenge = data as Challenge;
  const prizes = (challenge.prize_structure ?? []) as PrizeTier[];
  const pool = prizes.reduce((sum, t) => {
    const seats = t.positions ? t.positions[1] - t.positions[0] + 1 : 1;
    return sum + t.amount * seats;
  }, 0);

  return (
    <Page className="pt-10">
      <div className="max-w-[560px]">
        <BackButton href="/admin/challenges" />
        <div className="mt-3">
          <Eyebrow>challenge</Eyebrow>
          <h1 className="mt-2 font-serif text-[36px] leading-none text-primary">{challenge.name}</h1>
          <p className="mt-2 font-mono text-[12px] text-tertiary">
            {challenge.status} · {challenge.start_date} → {challenge.end_date} · {fmtNaira(pool)} pool
          </p>
        </div>

        <section className="mt-10">
          <Eyebrow>features</Eyebrow>
          <div className="mt-3">
            <MarksToggle challengeId={challenge.id} initial={challenge.marks_enabled === true} />
          </div>
        </section>

        <p className="mt-8 font-mono text-[11px] text-quaternary">
          Editing &amp; lifecycle transitions — coming in v1.1
        </p>
      </div>
    </Page>
  );
}
