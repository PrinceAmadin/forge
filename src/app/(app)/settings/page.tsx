import { redirect } from "next/navigation";
import { getUser, getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Eyebrow, Page } from "@/components/ui";
import { signOut } from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getUser();
  if (!user) redirect("/auth");
  const profile = await getProfile();
  if (!profile) redirect("/welcome");

  const supabase = await createClient();
  const { data: hall } = profile.hall_id
    ? await supabase.from("halls").select("name").eq("id", profile.hall_id).maybeSingle()
    : { data: null };

  return (
    <Page className="pt-10">
      <div className="max-w-[480px] pb-28 sm:pb-10">
        <Eyebrow>settings</Eyebrow>
        <h1 className="mt-3 text-[22px] font-medium text-primary">{profile.full_name}</h1>
        <p className="mt-1 text-[13px] text-secondary">
          {[hall?.name, profile.course].filter(Boolean).join(" · ")}
        </p>

        {/* 32px to the list. One item for now. §13 */}
        <div className="mt-8">
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
