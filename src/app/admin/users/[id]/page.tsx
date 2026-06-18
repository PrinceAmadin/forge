import { notFound } from "next/navigation";
import { requireSuperAdmin, getUser } from "@/lib/auth";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { Eyebrow, Page } from "@/components/ui";
import { BackButton } from "@/components/BackButton";
import { UserDetail, type HistoryItem } from "./user-detail";

export const dynamic = "force-dynamic";

const MANUAL_PREFIX = "Manual entry";

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperAdmin();
  const { id } = await params;
  const me = await getUser();
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, course, hall_id, role")
    .eq("id", id)
    .maybeSingle();
  if (!profile) notFound();

  const [{ data: hall }, { data: subsRaw }, authUser] = await Promise.all([
    profile.hall_id
      ? supabase.from("halls").select("name").eq("id", profile.hall_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("submissions")
      .select("id, challenge_day, hours_claimed, hours_credited, topic, status, submitted_at")
      .eq("participant_id", id)
      .order("challenge_day", { ascending: false }),
    admin.auth.admin.getUserById(id),
  ]);

  const subs = (subsRaw ?? []) as HistoryItem[];
  // Detect manual entries by topic prefix (works regardless of migration state).
  const manualEntries = subs.filter((s) => s.topic.startsWith(MANUAL_PREFIX));
  const history = subs.filter((s) => !s.topic.startsWith(MANUAL_PREFIX));

  return (
    <Page className="pt-10">
      <div className="max-w-[560px]">
        <BackButton href="/admin/users" />
        <div className="mt-3">
          <Eyebrow>user</Eyebrow>
          <h1 className="mt-2 font-serif text-[36px] leading-none text-primary">{profile.full_name}</h1>
          <p className="mt-2 text-[13px] text-secondary">
            {[hall?.name, profile.course, authUser.data.user?.email].filter(Boolean).join(" · ")}
          </p>
        </div>

        <UserDetail
          userId={profile.id}
          currentRole={profile.role}
          isSelf={me?.id === profile.id}
          manualEntries={manualEntries}
          history={history}
        />
      </div>
    </Page>
  );
}
