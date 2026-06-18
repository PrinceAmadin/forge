import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Eyebrow, Page } from "@/components/ui";
import { signOut } from "./actions";

export const dynamic = "force-dynamic";

const rowClass =
  "block w-full border-t border-[#27272a] py-4 text-left text-[14px] transition-colors";

export default async function SettingsPage() {
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

  return (
    <Page className="pt-10">
      <div className="max-w-[480px] pb-28 sm:pb-10">
        <Eyebrow>settings</Eyebrow>
        <h1 className="mt-3 text-[22px] font-medium text-primary">{profile.full_name}</h1>
        <p className="mt-1 text-[13px] text-secondary">
          {[hall?.name, profile.course].filter(Boolean).join(" · ")}
        </p>

        {/* Operations — server-gated; never rendered for participants. §13 */}
        {isAdmin && (
          <section className="mt-10">
            <Eyebrow>operations</Eyebrow>
            <div className="mt-3 border-b border-[#27272a]">
              <Link href="/admin/queue" className={`${rowClass} text-primary active:text-secondary sm:hover:text-secondary`}>
                Review queue
              </Link>
              {isSuper && (
                <Link href="/admin/challenges" className={`${rowClass} text-primary active:text-secondary sm:hover:text-secondary`}>
                  Manage challenges
                </Link>
              )}
              {isSuper && <ComingSoonRow label="User management" />}
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
