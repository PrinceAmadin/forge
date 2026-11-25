import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Page } from "@/components/ui";
import { PageHeader } from "@/components/nav/page-header";
import { AppealForm } from "./appeal-form";

export const dynamic = "force-dynamic";

export default async function AppealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) redirect("/auth");
  const supabase = await createClient();

  const { data: sub } = await supabase
    .from("submissions")
    .select("id, participant_id, challenge_day, status, rejection_reason")
    .eq("id", id)
    .maybeSingle();
  if (!sub || sub.participant_id !== user.id) notFound();
  if (sub.status !== "rejected") redirect(`/submissions/${id}`);

  const { data: existing } = await supabase
    .from("appeals")
    .select("id")
    .eq("submission_id", id)
    .maybeSingle();
  if (existing) redirect(`/submissions/${id}`);

  return (
    <>
      <PageHeader title={`Appeal day ${sub.challenge_day}`} backHref={`/submissions/${id}`} />
      <Page className="pt-8">
      <div className="max-w-[480px]">
        {sub.rejection_reason && (
          <blockquote className="mt-6 border-l-2 border-[#3f3f46] pl-4 text-[14px] italic text-tertiary">
            {sub.rejection_reason}
          </blockquote>
        )}

        <AppealForm submissionId={id} userId={user.id} />
      </div>
      </Page>
    </>
  );
}
