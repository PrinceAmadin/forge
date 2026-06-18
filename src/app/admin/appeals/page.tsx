import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Eyebrow, Page } from "@/components/ui";
import { BackButton } from "@/components/BackButton";
import { fmtHours, timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

interface AppealRow {
  id: string;
  created_at: string;
  submission_id: string;
  submissions: { challenge_day: number; hours_claimed: number; participant_id: string } | null;
}

export default async function AdminAppealsPage() {
  await requireAdmin();
  const supabase = await createClient();

  // Single, unambiguous FK from appeals -> submissions.
  const { data: raw } = await supabase
    .from("appeals")
    .select("id, created_at, submission_id, submissions!appeals_submission_id_fkey(challenge_day, hours_claimed, participant_id)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const appeals = (raw ?? []) as unknown as AppealRow[];
  const pids = [...new Set(appeals.map((a) => a.submissions?.participant_id).filter(Boolean) as string[])];
  const { data: profs } = pids.length
    ? await supabase.from("profiles").select("id, full_name").in("id", pids)
    : { data: [] as { id: string; full_name: string }[] };
  const nameById = new Map((profs ?? []).map((p) => [p.id, p.full_name]));

  return (
    <Page className="pt-10">
      <div className="max-w-[640px]">
        <BackButton href="/admin/queue" />
        <div className="mt-3">
          <Eyebrow>operations</Eyebrow>
          <h1 className="mt-2 font-serif text-[36px] leading-none text-primary">Appeals</h1>
        </div>

        {appeals.length === 0 ? (
          <p className="mt-8 text-[14px] text-tertiary">No appeals waiting.</p>
        ) : (
          <ul className="mt-6 border-b border-[#27272a]">
            {appeals.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/admin/appeals/${a.id}`}
                  className="flex items-center justify-between gap-4 border-t border-[#27272a] py-3.5 transition-colors active:bg-zinc-900/40 sm:hover:bg-zinc-900/40"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] text-primary">
                      {a.submissions ? nameById.get(a.submissions.participant_id) ?? "Unknown" : "Unknown"}
                    </span>
                    <span className="block font-mono text-[11px] text-tertiary">
                      Day {a.submissions?.challenge_day} · {fmtHours(a.submissions?.hours_claimed ?? 0)}h · {timeAgo(a.created_at)}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-accent">review →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Page>
  );
}
