import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Eyebrow, Page } from "@/components/ui";
import { fmtNaira } from "@/lib/format";
import type { PrizeTier } from "@/lib/types";

export const dynamic = "force-dynamic";

// Read-only for launch. Creation/editing lifecycle transitions are V1.1. §13.12
export default async function AdminChallengesPage() {
  await requireSuperAdmin();
  const supabase = await createClient();
  const { data: challenges } = await supabase
    .from("challenges")
    .select("id, slug, name, status, start_date, end_date, prize_structure, prize_line_position")
    .order("start_date", { ascending: true });

  return (
    <Page className="pt-10">
      <div className="max-w-[640px] pb-28 sm:pb-10">
        <div className="flex items-baseline justify-between">
          <Eyebrow>operations</Eyebrow>
          <Link href="/admin/queue" className="font-mono text-[11px] text-accent">
            review queue →
          </Link>
        </div>
        <h1 className="mt-2 font-serif text-[36px] leading-none text-primary">Challenges</h1>

        <ul className="mt-8">
          {(challenges ?? []).map((c) => {
            const prizes = (c.prize_structure ?? []) as PrizeTier[];
            const pool = prizes.reduce((sum, t) => {
              const seats = t.positions ? t.positions[1] - t.positions[0] + 1 : 1;
              return sum + t.amount * seats;
            }, 0);
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
  );
}
