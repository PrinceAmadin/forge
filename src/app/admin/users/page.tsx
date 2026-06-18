import { requireSuperAdmin } from "@/lib/auth";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { Page } from "@/components/ui";
import { PageHeader } from "@/components/nav/page-header";
import { UsersList, type UserRow } from "./users-list";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  await requireSuperAdmin();
  const { deleted } = await searchParams;
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
    <>
      <PageHeader title="All readers" backHref="/settings" />
      <Page className="pt-8">
      <div className="max-w-[640px]">
        {deleted && (
          <p className="mb-6 rounded-md border border-accent/40 bg-accent/5 px-4 py-3 text-[13px] text-accent">
            Account deleted.
          </p>
        )}
        <UsersList users={users} />
      </div>
      </Page>
    </>
  );
}
