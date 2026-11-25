import { redirect } from "next/navigation";
import { getUser, getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Page } from "@/components/ui";
import { PageHeader } from "@/components/nav/page-header";
import { ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

// Strip a stored E.164 (+234…) / 0-prefixed number down to the 10-digit local
// part shown after the static +234 prefix in the form.
function phoneLocalPart(phone: string | null): string {
  if (!phone) return "";
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("234")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  return d;
}

export default async function EditProfilePage() {
  const user = await getUser();
  if (!user) redirect("/auth");
  const profile = await getProfile();
  if (!profile) redirect("/welcome");

  const supabase = await createClient();
  const { data: halls } = await supabase.from("halls").select("id, name").order("name");

  return (
    <>
      <PageHeader title="Edit profile" backHref="/settings" />
      <Page className="pt-8">
        <div className="max-w-[480px]">
          <ProfileForm
            halls={halls ?? []}
            email={user.email ?? ""}
            initial={{
              full_name: profile.full_name,
              hall_id: profile.hall_id ?? "",
              course: profile.course,
              phone_local: phoneLocalPart(profile.phone),
            }}
          />
        </div>
      </Page>
    </>
  );
}
