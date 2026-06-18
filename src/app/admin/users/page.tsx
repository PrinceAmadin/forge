import { requireSuperAdmin } from "@/lib/auth";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { Eyebrow, Page } from "@/components/ui";
import { BackButton } from "@/components/BackButton";
import { UsersList, type UserRow } from "./users-list";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireSuperAdmin();
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .order("full_name");

  // Emails live in auth.users — fetch via the admin API and map by id.
  const { data: authList } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailById = new Map((authList?.users ?? []).map((u) => [u.id, u.email ?? ""]));

  const users: UserRow[] = (profiles ?? []).map((p) => ({
    id: p.id,
    fullName: p.full_name,
    role: p.role,
    email: emailById.get(p.id) ?? "",
  }));

  return (
    <Page className="pt-10">
      <div className="max-w-[640px]">
        <BackButton href="/admin/queue" />
        <div className="mt-3">
          <Eyebrow>users</Eyebrow>
          <h1 className="mt-2 font-serif text-[36px] leading-none text-primary">All readers</h1>
        </div>
        <UsersList users={users} />
      </div>
    </Page>
  );
}
