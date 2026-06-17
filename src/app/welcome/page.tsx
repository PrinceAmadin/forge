import { redirect } from "next/navigation";
import { getUser, getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { WelcomeForm } from "./welcome-form";

export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const user = await getUser();
  if (!user) redirect("/auth");

  // Already onboarded → skip.
  const profile = await getProfile();
  if (profile) redirect("/exam-flame");

  const supabase = await createClient();
  const { data: halls } = await supabase.from("halls").select("id, name").order("name");

  return <WelcomeForm halls={halls ?? []} userId={user.id} />;
}
