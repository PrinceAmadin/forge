import { redirect } from "next/navigation";
import { getUser, getProfile } from "@/lib/auth";
import { safeNext } from "@/lib/next-path";
import { createClient } from "@/lib/supabase/server";
import { WelcomeForm } from "./welcome-form";

export const dynamic = "force-dynamic";

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const user = await getUser();
  if (!user) redirect("/auth");

  // Already onboarded → skip.
  const profile = await getProfile();
  // Honour ?next= so the join funnel lands back on the challenge the user
  // came from. Only same-site challenge paths are accepted.
  if (profile) redirect(safeNext(next));

  const supabase = await createClient();
  const { data: halls } = await supabase.from("halls").select("id, name").order("name");

  return <WelcomeForm halls={halls ?? []} userId={user.id} next={safeNext(next)} />;
}
