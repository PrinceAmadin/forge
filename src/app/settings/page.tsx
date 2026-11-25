import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Eyebrow, Page } from "@/components/ui";
import { PageHeader } from "@/components/nav/page-header";
import { getAdminPendingCounts } from "@/lib/admin/pending-counts";
import { signOut } from "./actions";

export const dynamic = "force-dynamic";

const rowClass =
  "block w-full border-t border-[#27272a] py-4 text-left text-[14px] transition-colors";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ updated?: string }>;
}) {
  const { updated } = await searchParams;
  const user = await getUser();
  if (!user) redirect("/auth");
  const profile = await getProfile();
  if (!profile) redirect("/welcome");

  const supabase = await createClient();
  const { data: hall } = profile.hall_id
    ? await supabase.from("halls").select("name").eq("id", profile.hall_id).maybeSingle()
    : { data: null };

  const isAdmin = profile.role === "admin" || profile.role === "super_admin";
  const isSuper = profile.role === "super_admin";
  const pending = isAdmin ? await getAdminPendingCounts() : null;

  return (
    <>
      <PageHeader title="Settings" backHref="/leaderboard" />
      <Page className="pt-8">
      <div className="max-w-[480px]">
        {updated && (
          <p className="mb-6 rounded-md border border-accent/40 bg-accent/5 px-4 py-3 text-[13px] text-accent">
            Profile updated.
          </p>
        )}
        <h1 className="text-[22px] font-medium text-primary">{profile.full_name}</h1>
        <p className="mt-1 text-[13px] text-secondary">
          {[hall?.name, profile.course].filter(Boolean).join(" · ")}
        </p>

        {/* Self-service profile editing. §profile-edit */}
        <Link href="/settings/profile" className="mt-4 inline-block text-[14px] text-accent">
          Edit profile →
        </Link>

        {/* Operations — server-gated; never rendered for participants. §13 */}
        {isAdmin && (
          <section className="mt-10">
            <Eyebrow>operations</Eyebrow>
            <div className="mt-3 border-b border-[#27272a]">
              <Link href="/admin/queue" className={`${rowClass} text-primary active:text-secondary sm:hover:text-secondary`}>
                Review queue
                {pending && pending.pendingSubmissions > 0 && (
                  <span className="font-mono text-[13px] text-secondary"> · {pending.pendingSubmissions}</span>
                )}
              </Link>
              <Link href="/admin/appeals" className={`${rowClass} text-primary active:text-secondary sm:hover:text-secondary`}>
                Review appeals
                {pending && pending.pendingAppeals > 0 && (
                  <span className="font-mono text-[13px] text-secondary"> · {pending.pendingAppeals}</span>
                )}
              </Link>
              {isSuper && (
                <Link href="/admin/challenges" className={`${rowClass} text-primary active:text-secondary sm:hover:text-secondary`}>
                  Manage challenges
                </Link>
              )}
              {isSuper && (
                <Link href="/admin/users" className={`${rowClass} text-primary active:text-secondary sm:hover:text-secondary`}>
                  User management
                </Link>
              )}
              {isSuper && <ComingSoonRow label="Audit log" />}
            </div>
          </section>
        )}

        {/* Account */}
        <div className="mt-10">
          <form action={signOut}>
            <button
              type="submit"
              className="w-full border-y border-[#27272a] py-4 text-left text-[14px] text-primary transition-colors active:text-secondary sm:hover:text-secondary"
            >
              Sign out
            </button>
          </form>
        </div>

        <p className="mt-10 font-mono text-[11px] text-quaternary">Forge · v0.1</p>
      </div>
      </Page>
    </>
  );
}

function ComingSoonRow({ label }: { label: string }) {
  return (
    <div className={`${rowClass} flex items-center justify-between text-tertiary`}>
      <span>{label}</span>
      <span className="font-mono text-[11px] text-quaternary">coming soon</span>
    </div>
  );
}
