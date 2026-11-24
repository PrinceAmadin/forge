import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Page } from "@/components/ui";
import { PageHeader } from "@/components/nav/page-header";
import { fmtNaira } from "@/lib/format";
import { prizePool } from "@/lib/challenge";
import type { Challenge } from "@/lib/types";

export const dynamic = "force-dynamic";

// Read-only for launch. Creation/editing lifecycle transitions are V1.1. §13.12
export default async function AdminChallengesPage() {
  await requireSuperAdmin();
  const supabase = await createClient();
  // select("*") so reward_kind is present once migration 0015 lands — prizePool
  // needs it to know whether a challenge pays money at all.
  const { data } = await supabase
    .from("challenges")
    .select("*")
    .order("start_date", { ascending: true });
  const challenges = (data ?? []) as Challenge[];

  return (
    <>
      <PageHeader title="Challenges" backHref="/settings" />
      <Page className="pt-8">
      <div className="max-w-[640px] pb-28 sm:pb-10">
        <div className="flex justify-end">
          <Link href="/admin/queue" className="font-mono text-[11px] text-accent">
            review queue →
          </Link>
        </div>

        <ul className="mt-6">
          {challenges.map((c) => {
            const pool = prizePool(c);
            return (
              <li key={c.id}>
                <Link
                  href={`/admin/challenges/${c.id}`}
                  className="block border-t border-[#27272a] py-4 transition-colors active:bg-zinc-900/40 sm:hover:bg-zinc-900/40"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-[15px] text-primary">{c.name}</span>
                    <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-tertiary">
                      {c.status}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-[12px] text-tertiary">
                    {c.start_date} → {c.end_date} · cut at {c.prize_line_position} · {fmtNaira(pool)} pool
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="mt-8 font-mono text-[11px] text-quaternary">
          Editing &amp; lifecycle transitions — coming in v1.1
        </p>
      </div>
      </Page>
    </>
  );
}
